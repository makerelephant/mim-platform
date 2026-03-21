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
  entityName?: string;
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

// ─── Inline SVG Icons ───────────────────────────────────────────────────────

function IconUser({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconShare({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#627c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function IconEdit({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#627c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconPencil({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#627c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconSave({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#627c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function IconInbox({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#627c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconArrowUpRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1e252a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="10" height="5" viewBox="0 0 10 5" fill="none">
      <path d="M1 1L5 4L9 1" stroke="#1e252a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBuilding({ size = 24, stroke = "#9ca5a9" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

function IconPlusCircle({ size = 20, stroke = "#627c9e" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IconTrash({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#627c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ─── Font helper ────────────────────────────────────────────────────────────

const geist = "var(--font-geist-sans), 'Geist', sans-serif";

// ─── Component ──────────────────────────────────────────────────────────────

export default function ContactPanel({ contactId, entityName, onDismiss }: ContactPanelProps) {
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
  const [saveError, setSaveError] = useState<string | null>(null);

  // Notes
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

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
      const res = await fetch(`/api/contacts/${contactId}`, { cache: "no-store" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Contact not found");
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
    requestAnimationFrame(() => setVisible(true));
  }, [fetchContact]);

  // ── Resolved display name ──
  const displayName = contact?.name || entityName || "Unknown";

  // ── Edit handlers ──
  function startEdit() {
    setEditName(contact?.name || entityName || "");
    setEditTitle(contact?.title || "");
    setEditEmail(contact?.email || "");
    setEditPhone(contact?.phone || "");
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
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
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveError(errData.error || "Failed to save");
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // ── Notes ──
  async function saveNote() {
    setSavingNote(true);
    setNoteSaved(false);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText }),
      });
      if (res.ok) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }
    } finally {
      setSavingNote(false);
    }
  }

  // ── Share ──
  function shareContact() {
    const lines = [displayName];
    if (contact?.title) lines.push(contact.title);
    if (contact?.email) lines.push(contact.email);
    if (contact?.phone) lines.push(contact.phone);
    navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  }

  // ── Organization search ──
  async function handleOrgSearch(query: string) {
    setOrgSearch(query);
    if (!query.trim()) {
      setOrgResults([]);
      return;
    }
    setSearchingOrgs(true);
    try {
      const res = await fetch(`/api/contacts/search-orgs?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOrgResults(data.organizations || []);
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
        setOrgResults([]);
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
      ref={panelRef}
      className="fixed z-50 flex flex-col overflow-y-auto transition-all duration-200 ease-out"
      style={{
        top: "189px",
        right: "24px",
        width: "384px",
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 213px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        background: "rgba(255,255,255,0.4)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0px 0px 40px 0px rgba(0,0,0,0.08)",
        borderRadius: "12px",
        padding: "24px 12px",
        gap: "18px",
      }}
    >
      {/* ════════════════════════════════════════════════════════════════════
          1. HEADER ROW — Badge (left) | Share + Edit (right)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between shrink-0 px-[12px]">
        {/* Contact badge — solid #627c9e bg, white text per Figma */}
        <div
          className="flex items-center justify-center rounded-[4px]"
          style={{
            backgroundColor: "#627c9e",
            height: "26px",
            padding: "6px 8px",
          }}
        >
          <IconUser size={16} />
          <span
            className="font-medium text-white whitespace-nowrap"
            style={{ fontFamily: geist, fontSize: "12px" }}
          >
            Contact
          </span>
        </div>

        {/* Right: Share + Edit — light blue bg per Figma */}
        <div className="flex items-center gap-[12px]">
          <button
            onClick={shareContact}
            className="flex items-center justify-center rounded-[6px] hover:opacity-80 transition-opacity shrink-0"
            style={{ width: "26px", height: "26px", backgroundColor: "#ecfaff" }}
            title="Copy contact info"
          >
            <IconShare size={16} />
          </button>
          <button
            onClick={editing ? cancelEdit : startEdit}
            className="flex items-center justify-center rounded-[6px] hover:opacity-80 transition-opacity shrink-0"
            style={{ width: "26px", height: "26px", backgroundColor: "#ecfaff" }}
            title={editing ? "Cancel edit" : "Edit contact"}
          >
            <IconEdit size={16} />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          BODY
          ════════════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-[14px] text-[#6B7280]">{error}</p>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════
              2. CONTACT INFO SECTION
              ══════════════════════════════════════════════════════════════ */}
          <div
            className="flex flex-col gap-[10px] rounded-[4px]"
            style={{ backgroundColor: "rgba(248,248,248,0.6)", padding: "12px" }}
          >
            {/* Person card */}
            <div className="bg-white overflow-clip rounded-[4px] p-[6px]">
              <div className="flex gap-[12px] items-start">
                {/* Avatar */}
                <div
                  className="shrink-0 rounded-full flex items-center justify-center"
                  style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: "#E5E7EB",
                    boxShadow: "0px 0px 4px 0px rgba(0,0,0,0.25)",
                  }}
                >
                  <span className="text-[18px] font-medium text-[#6B7280]" style={{ fontFamily: geist }}>
                    {getInitials(displayName)}
                  </span>
                </div>

                {/* Details */}
                <div className="flex flex-col min-w-0 flex-1">
                  {editing ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-semibold text-black bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full"
                        style={{ fontFamily: geist, fontSize: "16px" }}
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-[#3e4c60] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full mt-[2px]"
                        style={{ fontFamily: geist, fontSize: "12px" }}
                        placeholder="Title"
                      />
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="text-[#1873de] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full mt-[2px]"
                        style={{ fontFamily: geist, fontSize: "12px" }}
                        placeholder="Email"
                      />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="text-[#3e4c60] bg-gray-50 border border-gray-200 rounded px-[6px] py-[2px] focus:outline-none focus:ring-1 focus:ring-blue-300 w-full mt-[2px]"
                        style={{ fontFamily: geist, fontSize: "12px" }}
                        placeholder="Phone"
                      />
                      {saveError && (
                        <p className="text-[11px] text-red-500 mt-[2px]" style={{ fontFamily: geist }}>{saveError}</p>
                      )}
                      <div className="flex gap-[8px] mt-[4px]">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-[10px] py-[2px] text-[12px] font-medium text-white bg-[#627c9e] rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                          style={{ fontFamily: geist }}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-[10px] py-[2px] text-[12px] font-medium text-[#627c9e] hover:text-[#1e252a] transition-colors"
                          style={{ fontFamily: geist }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className="font-semibold text-black"
                        style={{
                          fontFamily: geist,
                          fontSize: "16px",
                          textDecoration: "underline",
                          textDecorationStyle: "dotted",
                        }}
                      >
                        {displayName}
                      </span>
                      <div
                        className="font-normal"
                        style={{ fontFamily: geist, fontSize: "12px", lineHeight: "16px" }}
                      >
                        {contact?.title && (
                          <div style={{ color: "#3e4c60" }}>{contact.title}</div>
                        )}
                        {contact?.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="block hover:underline"
                            style={{ color: "#1873de" }}
                          >
                            {contact.email}
                          </a>
                        )}
                        {contact?.phone && (
                          <div style={{ color: "#3e4c60" }}>{contact.phone}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Organization card */}
            <div className="bg-white overflow-clip rounded-[4px] p-[6px] relative">
              <div className="flex items-center justify-between pr-[6px]">
                <div className="flex items-center gap-[12px]">
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center"
                    style={{
                      width: "48px",
                      height: "48px",
                      backgroundColor: "#F3F4F6",
                      boxShadow: "0px 0px 4px 0px rgba(0,0,0,0.25)",
                    }}
                  >
                    <IconBuilding size={24} stroke={organization ? "#9ca5a9" : "#d1d5db"} />
                  </div>

                  {organization ? (
                    <span
                      className="font-semibold text-black"
                      style={{
                        fontFamily: geist,
                        fontSize: "16px",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                      }}
                    >
                      {organization.name || "Unknown Org"}
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                      className="font-semibold hover:opacity-80 transition-opacity"
                      style={{
                        fontFamily: geist,
                        fontSize: "16px",
                        color: "#627c9e",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                      }}
                    >
                      Add Organization
                    </button>
                  )}
                </div>

                {organization && (
                  <button
                    onClick={removeOrg}
                    className="shrink-0 hover:opacity-60 transition-opacity"
                    title="Remove organization"
                  >
                    <IconTrash size={16} />
                  </button>
                )}
              </div>

              {/* Org search dropdown */}
              {showOrgDropdown && (
                <div
                  className="absolute left-0 right-0 bg-white rounded-b-[4px]"
                  style={{
                    top: "100%",
                    boxShadow: "0px 2px 8px 0px rgba(0,0,0,0.15)",
                    padding: "8px",
                    zIndex: 10,
                  }}
                >
                  <input
                    type="text"
                    value={orgSearch}
                    onChange={(e) => handleOrgSearch(e.target.value)}
                    placeholder="Search organizations..."
                    className="w-full text-[12px] px-[8px] py-[6px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 bg-gray-50"
                    style={{ fontFamily: geist }}
                    autoFocus
                  />
                  {searchingOrgs && (
                    <p className="text-[11px] text-[#9ca5a9] mt-[4px] px-[4px]" style={{ fontFamily: geist }}>Searching...</p>
                  )}
                  {orgResults.length > 0 && (
                    <div className="flex flex-col mt-[4px]">
                      {orgResults.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => assignOrg(org.id)}
                          className="text-left hover:bg-blue-50 transition-colors rounded px-[6px] py-[4px]"
                        >
                          <span
                            className="font-medium"
                            style={{
                              fontFamily: geist,
                              fontSize: "14px",
                              color: "#1e252a",
                            }}
                          >
                            {org.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {orgSearch && !searchingOrgs && orgResults.length === 0 && (
                    <p className="text-[11px] text-[#9ca5a9] mt-[4px] px-[4px]" style={{ fontFamily: geist }}>No organizations found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              3. NOTES SECTION
              ══════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-[12px]">
            <div className="flex gap-[4px] items-start">
              <IconPencil size={14} />
              <span
                className="font-medium"
                style={{ fontFamily: geist, fontSize: "12px", color: "#627c9e", lineHeight: "14px" }}
              >
                Add A Note
              </span>
            </div>

            <div
              className="rounded-[4px] flex flex-col items-start p-[12px]"
              style={{ backgroundColor: "rgba(248,248,248,0.6)" }}
            >
              <div className="flex flex-col gap-[12px] items-end w-full">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Observations, favorite food, inside information    &#x1F354; &#x1F3F7;&#xFE0F; &#x1F440;..."
                  className="w-full resize-none bg-white focus:outline-none"
                  style={{
                    fontFamily: geist,
                    fontSize: "12px",
                    color: "#1e252a",
                    height: "80px",
                    border: "0.5px solid #c7d2e5",
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                />
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="flex items-center gap-[4px] rounded-[8px] hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: "#ecfaff",
                    border: "1px solid #b9cee8",
                    height: "26px",
                    padding: "4px 12px",
                  }}
                >
                  <span
                    className="font-medium"
                    style={{ fontFamily: geist, fontSize: "12px", color: "#627c9e" }}
                  >
                    {savingNote ? "Saving..." : noteSaved ? "Saved!" : "Save"}
                  </span>
                  <IconSave size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              4. CORRESPONDENCE SECTION
              ══════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-[12px]">
            <div className="flex gap-[4px] items-center">
              <IconInbox size={14} />
              <span
                className="font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                style={{ fontFamily: geist, fontSize: "12px", color: "#627c9e", lineHeight: "1.2" }}
              >
                Correspondence
              </span>
            </div>

            {correspondence.length === 0 ? (
              <p style={{ fontFamily: geist, fontSize: "12px", color: "#9ca5a9" }}>
                No correspondence yet
              </p>
            ) : (
              <div className="flex flex-col gap-[12px]">
                {displayedCorrespondence.map((item) => {
                  const threadUrl = gmailThreadUrl(item.metadata);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-[6px] rounded-[4px]"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.5)",
                        padding: "6px 12px",
                        width: "360px",
                        maxWidth: "100%",
                      }}
                    >
                      {/* Title row */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className="font-semibold text-black truncate"
                          style={{ fontFamily: geist, fontSize: "16px", lineHeight: "20px" }}
                        >
                          {item.title}
                        </span>
                        {threadUrl && (
                          <a
                            href={threadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 hover:opacity-60 transition-opacity ml-[8px]"
                          >
                            <IconArrowUpRight size={16} />
                          </a>
                        )}
                      </div>
                      {/* Body preview */}
                      {item.body && (
                        <p
                          className="font-normal w-full overflow-hidden"
                          style={{
                            fontFamily: geist,
                            fontSize: "12px",
                            color: "#6e7b80",
                            lineHeight: "1.25",
                            textOverflow: "ellipsis",
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
                        className="font-medium"
                        style={{ fontFamily: geist, fontSize: "10px", color: "#1e252a", lineHeight: "1.417" }}
                      >
                        {timeAgoShort(item.created_at)} ago
                      </span>
                    </div>
                  );
                })}

                {/* Read More / Show Less */}
                {correspondence.length > 3 && (
                  <button
                    onClick={() => setShowAllCorrespondence(!showAllCorrespondence)}
                    className="flex items-center gap-[6px] rounded-[8px] self-start hover:opacity-80 transition-opacity"
                    style={{ height: "26px", padding: "4px 12px" }}
                  >
                    <span
                      className="font-medium"
                      style={{ fontFamily: geist, fontSize: "12px", color: "#1e252a", lineHeight: "14px" }}
                    >
                      {showAllCorrespondence ? "Show Less" : "Read More"}
                    </span>
                    <div style={{ transform: showAllCorrespondence ? "scaleY(-1)" : "none" }}>
                      <IconChevronDown />
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
