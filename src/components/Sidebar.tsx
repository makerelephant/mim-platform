"use client";

/**
 * MiMbrain Sidebar
 * src/components/Sidebar.tsx
 *
 * Three sections separated by hard dividers:
 *   1. Personal (CEO brain)
 *   2. Business (orgs, people, pipeline)
 *   3. Tools (intelligence, settings)
 *
 * No accordion collapse — all sections always visible.
 * Section labels: small-caps uppercase gray dividers.
 * Active state: blue-600 pill, consistent with login page accent.
 * Sign out at bottom — placeholder until auth is wired up.
 *
 * Deferred items: hidden from nav entirely, except SETTINGS which shows them grayed.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Brain,
  CheckSquare,
  FileText,
  Building,
  TrendingUp,
  Handshake,
  Globe,
  Users,
  Shield,
  GitBranch,
  Send,
  History,
  BarChart3,
  Library,
  Newspaper,
  Bot,
  Plug,
  Lock,
  LogOut,
  type LucideIcon,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  deferred?: boolean;
  /** Exact query params to match for active state (e.g. { type: "investor" }) */
  matchQuery?: Record<string, string>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/* ── Navigation structure ───────────────────────────────────────────────────── */

const SECTION_1: NavSection = {
  label: "PERSONAL",
  items: [
    { href: "/",        label: "My Brain",  icon: Brain },
    { href: "/tasks",   label: "My Tasks",  icon: CheckSquare },
    { href: "/reports", label: "Reports",   icon: FileText, deferred: true },
  ],
};

const SECTION_2_ORGS: NavSection = {
  label: "ORGANIZATIONS",
  items: [
    { href: "/orgs",                label: "All",       icon: Building },
    { href: "/orgs?type=Investor",  label: "Investors", icon: TrendingUp,  matchQuery: { type: "Investor" } },
    { href: "/orgs?type=Partner",   label: "Partners",  icon: Handshake,   matchQuery: { type: "Partner" } },
    { href: "/orgs?type=Customer",  label: "Customers", icon: Globe,       matchQuery: { type: "Customer" } },
    { href: "/orgs?type=Vendor",    label: "Vendors",   icon: Building,    matchQuery: { type: "Vendor" } },
  ],
};

const SECTION_2_PEOPLE: NavSection = {
  label: "PEOPLE",
  items: [
    { href: "/contacts",      label: "All Contacts", icon: Users },
    { href: "/people/roles",  label: "Team",         icon: Shield },
  ],
};

const SECTION_2_PIPELINE: NavSection = {
  label: "PIPELINE",
  items: [
    { href: "/pipeline",  label: "All Deals",    icon: GitBranch },
    { href: "/outreach",  label: "Outreach",     icon: Send },
    { href: "/activity",  label: "Activity Log", icon: History },
  ],
};

const SECTION_3_TOOLS: NavSection = {
  label: "TOOLS",
  items: [
    { href: "/intelligence",    label: "Intelligence",    icon: BarChart3 },
    { href: "/applications",    label: "Gophers",         icon: Bot },
    { href: "/knowledge",       label: "Knowledge Base",  icon: Library },
    { href: "/news-sentiment",  label: "Sentiment",       icon: Newspaper },
  ],
};

const SECTION_3_SETTINGS: NavSection = {
  label: "SETTINGS",
  items: [
    { href: "/settings/taxonomy",     label: "Taxonomy",            icon: Brain },
    { href: "/settings/integrations", label: "Integrations",        icon: Plug,  deferred: true },
    { href: "/settings/users",        label: "Users & Permissions", icon: Lock,  deferred: true },
  ],
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function isActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: NavItem,
): boolean {
  if (item.deferred) return false;

  // Home route — exact match only
  if (item.href === "/") return pathname === "/";

  // Extract path portion (before ?)
  const itemPath = item.href.split("?")[0];

  // If item has query match criteria, must match path AND all query params
  if (item.matchQuery) {
    if (pathname !== itemPath && !pathname.startsWith(itemPath + "/")) return false;
    for (const [key, val] of Object.entries(item.matchQuery)) {
      if (searchParams.get(key) !== val) return false;
    }
    return true;
  }

  // For "All" orgs — match /orgs only when there's NO type param
  if (itemPath === "/orgs") {
    return (pathname === "/orgs" || pathname.startsWith("/orgs/")) && !searchParams.has("type");
  }

  // Default — prefix match
  return pathname.startsWith(itemPath);
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase select-none">
      {label}
    </p>
  );
}

function NavLink({
  item,
  pathname,
  searchParams,
}: {
  item: NavItem;
  pathname: string;
  searchParams: URLSearchParams;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, searchParams, item);

  if (item.deferred) {
    return (
      <span className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-600 cursor-default select-none">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{item.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center gap-3 px-3 py-[7px] rounded-md text-sm font-medium
        transition-all duration-100
        ${active
          ? "bg-blue-600 text-white shadow-sm shadow-blue-900/40"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }
      `}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${active ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`} />
      <span className="truncate">{item.label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-300 shrink-0" />
      )}
    </Link>
  );
}

function NavSectionBlock({
  section,
  pathname,
  searchParams,
  showDeferred,
}: {
  section: NavSection;
  pathname: string;
  searchParams: URLSearchParams;
  showDeferred?: boolean;
}) {
  return (
    <div>
      <SectionLabel label={section.label} />
      <div className="space-y-0.5 px-2">
        {section.items
          .filter((item) => showDeferred || !item.deferred)
          .map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} searchParams={searchParams} />
          ))}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 my-3 border-t border-slate-800" />;
}

/* ── Sidebar ────────────────────────────────────────────────────────────────── */

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSignOut() {
    // Placeholder — auth wired up in Phase 5
    window.location.href = "/login";
  }

  return (
    <aside
      className="w-56 bg-slate-900 flex flex-col shrink-0 border-r border-slate-800"
    >

      {/* ── Logo ── */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none" className="shrink-0">
            <path d="M4 22L10 6"  stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M10 22L16 6" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M16 22L22 6" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-semibold text-slate-200 tracking-[0.1em] uppercase">
            MiMbrain
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">

        {/* Section 1 — Personal */}
        <NavSectionBlock section={SECTION_1} pathname={pathname} searchParams={searchParams} />

        <Divider />

        {/* Section 2 — Business */}
        <NavSectionBlock section={SECTION_2_ORGS}     pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_2_PEOPLE}   pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_2_PIPELINE} pathname={pathname} searchParams={searchParams} />

        <Divider />

        {/* Section 3 — Tools & Settings */}
        <NavSectionBlock section={SECTION_3_TOOLS}    pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_3_SETTINGS}  pathname={pathname} searchParams={searchParams} showDeferred />

        {/* Bottom padding */}
        <div className="h-4" />

      </nav>

      {/* ── Sign out ── */}
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors duration-100"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>

    </aside>
  );
}
