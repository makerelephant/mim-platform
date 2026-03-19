"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContactData {
  id: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
  organization_id?: string;
}

interface OrgData {
  id: string;
  name?: string;
}

interface CorrespondenceItem {
  id: string;
  card_type: string;
  title: string;
  body?: string | null;
  source_type: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ContactPanelProps {
  contactId: string;
  onDismiss: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || "?";
}

function timeAgoShort(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: false });
}

function gmailThreadUrl(metadata?: Record<string, unknown>): string | null {
  const threadId = metadata?.thread_id as string | undefined;
  if (threadId) return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ContactPanel({ contactId, onDismiss }: ContactPanelProps) {
  const [contact, setContact] = useState<ContactData | null>(null);
  const [organization, setOrganization] = useState<OrgData | null>(null);
  const [correspondence, setCorrespondence] = useState<CorrespondenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Org dropdown
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState<OrgData[]>([]);
  const [searchingOrgs, setSearchingOrgs] = useState(false);

  // Correspondence expand
  const [showAllCorrespondence, setShowAllCorrespondence] = useState(false);

  // Animation state
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch contact data ──
  const fetchContact = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) {
        setError("Contact not found");
        return;
      }
      const data = await res.json();
      setContact(data.contact);
      setOrganization(data.organization);
      setCorrespondence(data.correspondence || []);
      setNoteText(data.contact?.notes || "");
    } catch {
      setError("Failed to load contact");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContact();
    // Trigger slide-in animation
    requestAnimationFrame(() => setVisible(true));
  }, [fetchContact]);

  // ── Edit handlers ──
  function startEdit() {
    if (!contact) return;
    setEditName(contact.name || "");
    setEditTitle(contact.title || "");
    setEditEmail(contact.email || "");
    setEditPhone(contact.phone || "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!contact) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          title: editTitle,
          email: editEmail,
          phone: editPhone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setContact(data.contact);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Notes ──
  async function saveNote() {
    if (!contact) return;
    setSavingNote(true);
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText }),
      });
    } finally {
      setSavingNote(false);
    }
  }

  // ── Share ──
  function shareContact() {
    if (!contact) return;
    const lines = [contact.name];
    if (contact.title) lines.push(contact.title);
    if (contact.email) lines.push(contact.email);
    if (contact.phone) lines.push(contact.phone);
    navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  }

  // ── Organization ──
  async function searchOrgs(query: string) {
    setOrgSearch(query);
    if (!query.trim()) {
      setOrgResults([]);
      return;
    }
    setSearchingOrgs(true);
    try {
      // Search organizations - use the feed API pattern with a simple fetch
      const res = await fetch(`/api/contacts/${contactId}`);
      if (res.ok) {
        // For now, just show a placeholder. In production this would query organizations table.
        setOrgResults([]);
      }
    } finally {
      setSearchingOrgs(false);
    }
  }

  async function assignOrg(orgId: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId }),
      });
      if (res.ok) {
        await fetchContact();
        setShowOrgDropdown(false);
        setOrgSearch("");
      }
    } catch {
      // silent
    }
  }

  async function removeOrg() {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: null }),
      });
      if (res.ok) {
        setOrganization(null);
        if (contact) setContact({ ...contact, organization_id: undefined });
      }
    } catch {
      // silent
    }
  }

  // ── Dismiss with animation ──
  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }

  // ── Click outside to dismiss ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleDismiss();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Displayed correspondence ──
  const displayedCorrespondence = showAllCorrespondence
    ? correspondence
    : correspondence.slice(0, 3);

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 transition-colors duration-200"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0)",
      }}
    >
      <div
        ref={panelRef}
        className="absolute top-0 right-0 h-full bg-white flex flex-col transition-transform duration-200 ease-out"
        style={{
          width: "384px",
          maxWidth: "100vw",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* ════════════════════════════════════════════════════════════════════
            1. HEADER BAR — 26px height, 12px padding
            ════════════════════════════════════════════════════════════════════ */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ height: "26px", padding: "0 12px", marginTop: "12px" }}
        >
          {/* Left: Badge + Dismiss */}
          <div className="flex items-center gap-[12px]">
            {/* Contact badge */}
            <div
              className="flex items-center gap-[4px] px-[8px] rounded-[4px]"
              style={{
                backgroundColor: "#EBF2FF",
                height: "26px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span
                className="text-[16px] font-medium leading-none"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  color: "#3B82F6",
                }}
              >
                Contact
              </span>
            </div>
            {/* Dismiss text */}
            <button
              onClick={handleDismiss}
              className="text-[14px] hover:opacity-60 transition-opacity"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                color: "#1e252a",
              }}
            >
              Dismiss
            </button>
          </div>

          {/* Right: Share + Edit */}
          <div className="flex items-center gap-[8px]">
            {/* Share */}
            <button
              onClick={shareContact}
              className="flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
              style={{ width: "26px", height: "26px" }}
              title="Copy contact info"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e252a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
            {/* Edit */}
            <button
              onClick={editing ? cancelEdit : startEdit}
              className="flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
              style={{ width: "26px", height: "26px" }}
              title={editing ? "Cancel edit" : "Edit contact"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e252a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SCROLLABLE BODY
            ════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "12px" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-[14px] text-[#6B7280]">{error}</p>
            </div>
          ) : contact ? (
            <div className="flex flex-col gap-[12px]">
              {/* ══════════════════════════════════════════════════════════════
                  2. CONTACT INFO SECTION
                  ══════════════════════════════════════════════════════════════ */}
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: "1px solid #E5E7EB" }}
              >
                {/* Row 1 — Contact details */}
                <div
                  className="flex items-center gap-[12px]"
                  style={{ padding: "12px", minHeight: "87px" }}
                >
                  {/* Avatar */}
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center"
                    style={{
                      width: "48px",
                      height: "48px",
                      backgroundColor: "#E5E7EB",
                    }}
                  >
                    <span
                      className="text-[18px] font-medium text-[#6B7280]"
                      style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                    >
                      {getInitials(contact.name)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                    {editing ? (
                      <>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-[16px] font-medium text-[#1e252a] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", height: "21px" }}
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-[14px] text-[#6B7280] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          placeholder="Title"
                        />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="text-[14px] text-[#3B82F6] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          placeholder="Email"
                        />
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="text-[14px] text-[#6B7280] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          placeholder="Phone"
                        />
                        <div className="flex gap-[8px] mt-[4px]">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-[10px] py-[2px] text-[12px] font-medium text-white bg-[#3B82F6] rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-[10px] py-[2px] text-[12px] font-medium text-[#6B7280] hover:text-[#1e252a] transition-colors"
                            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-[16px] font-medium text-[#1e252a] truncate"
                          style={{
                            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                            height: "21px",
                            lineHeight: "21px",
                            textDecoration: "underline",
                          }}
                        >
                          {contact.name || "Unknown"}
                        </span>
                        {contact.title && (
                          <span
                            className="text-[14px] text-[#6B7280] truncate"
                            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          >
                            {contact.title}
                          </span>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-[14px] text-[#3B82F6] truncate hover:underline"
                            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          >
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <span
                            className="text-[14px] text-[#6B7280]"
                            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          >
                            {contact.phone}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid #E5E7EB" }} />

                {/* Row 2 — Organization */}
                <div
                  className="flex items-center gap-[12px]"
                  style={{ padding: "12px", minHeight: "60px" }}
                >
                  {organization ? (
                    <>
                      {/* Org avatar */}
                      <div
                        className="shrink-0 rounded-lg flex items-center justify-center"
                        style={{
                          width: "48px",
                          height: "48px",
                          backgroundColor: "#F3F4F6",
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="2" width="16" height="20" rx="2" />
                          <path d="M9 22v-4h6v4" />
                          <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
                        </svg>
                      </div>
                      {/* Org name + remove */}
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span
                          className="text-[16px] font-medium text-[#1e252a] truncate"
                          style={{
                            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                            height: "21px",
                            lineHeight: "21px",
                          }}
                        >
                          {organization.name || "Unknown Org"}
                        </span>
                        <button
                          onClick={removeOrg}
                          className="shrink-0 hover:opacity-60 transition-opacity ml-[8px]"
                          title="Remove organization"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,6 5,6 21,6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Placeholder avatar */}
                      <div
                        className="shrink-0 rounded-lg flex items-center justify-center"
                        style={{
                          width: "48px",
                          height: "48px",
                          backgroundColor: "#F3F4F6",
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="2" width="16" height="20" rx="2" />
                          <path d="M9 22v-4h6v4" />
                          <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
                        </svg>
                      </div>
                      {/* Add Organization */}
                      <div className="flex items-center justify-between flex-1 min-w-0 relative">
                        <span
                          className="text-[16px] text-[#9CA3AF]"
                          style={{
                            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                            height: "21px",
                            lineHeight: "21px",
                          }}
                        >
                          Add Organization
                        </span>
                        <button
                          onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                          className="shrink-0 flex items-center justify-center rounded-full border border-[#D1D5DB] hover:border-[#9CA3AF] transition-colors ml-[8px]"
                          style={{ width: "24px", height: "24px" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Org dropdown */}
                {showOrgDropdown && (
                  <div
                    className="border-t border-[#E5E7EB]"
                    style={{ padding: "8px 12px" }}
                  >
                    <input
                      type="text"
                      value={orgSearch}
                      onChange={(e) => searchOrgs(e.target.value)}
                      placeholder="Search organizations..."
                      className="w-full text-[14px] px-[8px] py-[6px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 bg-gray-50"
                      style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                      autoFocus
                    />
                    {searchingOrgs && (
                      <p className="text-[12px] text-[#9CA3AF] mt-[4px] px-[4px]">Searching...</p>
                    )}
                    {orgResults.length > 0 && (
                      <div className="mt-[4px] max-h-[120px] overflow-y-auto">
                        {orgResults.map((org) => (
                          <button
                            key={org.id}
                            onClick={() => assignOrg(org.id)}
                            className="w-full text-left px-[8px] py-[6px] hover:bg-blue-50 rounded transition-colors"
                          >
                            <span
                              className="text-[16px] font-medium text-[#3B82F6]"
                              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                            >
                              {org.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {orgSearch && !searchingOrgs && orgResults.length === 0 && (
                      <p className="text-[12px] text-[#9CA3AF] mt-[4px] px-[4px]">No organizations found</p>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  3. NOTES SECTION
                  ══════════════════════════════════════════════════════════════ */}
              <div>
                {/* Label */}
                <div className="flex items-center gap-[6px] mb-[6px]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span
                    className="text-[14px] text-[#6B7280]"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    Add A Note
                  </span>
                </div>

                {/* Textarea container */}
                <div
                  className="rounded-lg relative"
                  style={{
                    backgroundColor: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                    padding: "12px",
                  }}
                >
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Meeting Notes, favorite food...."
                    className="w-full bg-transparent resize-none text-[14px] text-[#1e252a] placeholder:text-[#9CA3AF] focus:outline-none"
                    style={{
                      fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                      height: "80px",
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={saveNote}
                      disabled={savingNote}
                      className="flex items-center gap-[4px] px-[12px] rounded-[4px] text-[14px] font-medium transition-colors hover:bg-[#EBF2FF] disabled:opacity-50"
                      style={{
                        fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                        color: "#1e252a",
                        height: "26px",
                      }}
                    >
                      <span>{savingNote ? "Saving..." : "Save"}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17,21 17,13 7,13 7,21" />
                        <polyline points="7,3 7,8 15,8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  4. CORRESPONDENCE SECTION
                  ══════════════════════════════════════════════════════════════ */}
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-[8px]">
                  <div className="flex items-center gap-[6px]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
                      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </svg>
                    <span
                      className="text-[14px] font-medium text-[#6B7280]"
                      style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                    >
                      Correspondence
                    </span>
                  </div>
                  {contact.email && (
                    <a
                      href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact.email)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] text-[#3B82F6] hover:underline"
                      style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                    >
                      Compose
                    </a>
                  )}
                </div>

                {/* Correspondence list */}
                {correspondence.length === 0 ? (
                  <p
                    className="text-[14px] text-[#9CA3AF] py-[12px]"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    No correspondence yet
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {displayedCorrespondence.map((item, idx) => {
                      const threadUrl = gmailThreadUrl(item.metadata);
                      return (
                        <div key={item.id}>
                          {idx > 0 && (
                            <div style={{ borderTop: "1px solid #F3F4F6", margin: "0" }} />
                          )}
                          <div className="py-[8px]">
                            {/* Subject + external link */}
                            <div className="flex items-center justify-between gap-[8px]">
                              <span
                                className="text-[14px] font-medium text-[#1e252a] truncate"
                                style={{
                                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                                  height: "20px",
                                  lineHeight: "20px",
                                }}
                              >
                                {item.title}
                              </span>
                              {threadUrl && (
                                <a
                                  href={threadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 hover:opacity-60 transition-opacity"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M7 17l9.2-9.2M17 17V7H7" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            {/* Body preview — 2 lines */}
                            {item.body && (
                              <p
                                className="text-[14px] text-[#6B7280] mt-[2px]"
                                style={{
                                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                                  height: "34px",
                                  lineHeight: "17px",
                                  overflow: "hidden",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {item.body}
                              </p>
                            )}
                            {/* Time */}
                            <span
                              className="text-[12px] text-[#9CA3AF] mt-[2px] block"
                              style={{
                                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                                height: "17px",
                                lineHeight: "17px",
                                paddingLeft: "12px",
                              }}
                            >
                              {timeAgoShort(item.created_at)} ago
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Read More button */}
                    {correspondence.length > 3 && !showAllCorrespondence && (
                      <button
                        onClick={() => setShowAllCorrespondence(true)}
                        className="flex items-center gap-[6px] px-[12px] py-[4px] rounded-[8px] mt-[4px] self-start"
                        style={{ backgroundColor: "#f4efea" }}
                      >
                        <span
                          className="text-[14px] font-medium text-[#1e252a]"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                        >
                          Read More
                        </span>
                        <svg width="10" height="5" viewBox="0 0 10 5" fill="none">
                          <path d="M1 1L5 4L9 1" stroke="#1e252a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    {showAllCorrespondence && correspondence.length > 3 && (
                      <button
                        onClick={() => setShowAllCorrespondence(false)}
                        className="flex items-center gap-[6px] px-[12px] py-[4px] rounded-[8px] mt-[4px] self-start"
                        style={{ backgroundColor: "#f4efea" }}
                      >
                        <span
                          className="text-[14px] font-medium text-[#1e252a]"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                        >
                          Show Less
                        </span>
                        <svg width="10" height="5" viewBox="0 0 10 5" fill="none" style={{ transform: "scaleY(-1)" }}>
                          <path d="M1 1L5 4L9 1" stroke="#1e252a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
