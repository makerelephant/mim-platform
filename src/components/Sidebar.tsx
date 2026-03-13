"use client";

/**
 * MiMbrain Sidebar
 * src/components/Sidebar.tsx
 *
 * Dark sidebar (#3E4C60) with custom PNG icons from /public/icons/
 * Blue active state, user profile at bottom.
 */

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: string; // path to PNG in /public/icons/
  deferred?: boolean;
  matchQuery?: Record<string, string>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/* ── Navigation structure ───────────────────────────────────────────────────── */

const SECTION_PERSONAL: NavSection = {
  label: "PERSONAL",
  items: [
    { href: "/",          label: "My Brain",   icon: "/icons/Brain Icon.png" },
    { href: "/tasks",     label: "My Tasks",   icon: "/icons/Tasks Icon.png" },
    { href: "/decisions", label: "Decisions",  icon: "/icons/intelligence.png" },
  ],
};

const SECTION_ORGS: NavSection = {
  label: "ORGANIZATIONS",
  items: [
    { href: "/orgs",                label: "All Orgs",   icon: "/icons/all orgs.png" },
    { href: "/orgs?type=Investor",  label: "Investors",  icon: "/icons/Investors.png",  matchQuery: { type: "Investor" } },
    { href: "/orgs?type=Partner",   label: "Partners",   icon: "/icons/Partners.png",   matchQuery: { type: "Partner" } },
    { href: "/orgs?type=Customer",  label: "Customers",  icon: "/icons/Customers.png",  matchQuery: { type: "Customer" } },
    { href: "/orgs?type=Vendor",    label: "Vendors",    icon: "/icons/Vendors.png",    matchQuery: { type: "Vendor" } },
  ],
};

const SECTION_PEOPLE: NavSection = {
  label: "PEOPLE",
  items: [
    { href: "/contacts",        label: "All Contacts",  icon: "/icons/All Contacts.png" },
    { href: "/people/roles",    label: "Team Members",  icon: "/icons/Team Members.png" },
    { href: "/people/creators", label: "Creators",      icon: "/icons/Creators.png" },
  ],
};

const SECTION_PIPELINES: NavSection = {
  label: "PIPELINES",
  items: [
    { href: "/pipeline",              label: "Fundraising",   icon: "/icons/fund raising.png" },
    { href: "/pipeline?type=partner", label: "Partners",      icon: "/icons/partners pipeline.png", matchQuery: { type: "partner" } },
    { href: "/outreach",              label: "Outreach",      icon: "/icons/Outreach.png" },
    { href: "/activity",              label: "Activity Log",  icon: "/icons/Activity Log.png" },
  ],
};

const SECTION_TOOLS: NavSection = {
  label: "TOOLS",
  items: [
    { href: "/intelligence",    label: "Intelligence",  icon: "/icons/intelligence.png" },
    { href: "/knowledge",       label: "Knowledge",     icon: "/icons/knowledge.png" },
    { href: "/news-sentiment",  label: "Sentiment",     icon: "/icons/sentiment.png" },
    { href: "/applications",    label: "Gophers",       icon: "/icons/gophers.png" },
  ],
};

const SECTION_SETTINGS: NavSection = {
  label: "SETTINGS",
  items: [
    { href: "/settings/taxonomy",      label: "Taxonomy",            icon: "/icons/taxonomy.png" },
    { href: "/settings/integrations",  label: "Integrations",        icon: "/icons/integrations.png" },
    { href: "/settings/users",         label: "Users & Permissions", icon: "/icons/users.png" },
    { href: "/settings/account",       label: "Account Settings",    icon: "/icons/account settings.png" },
  ],
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function isActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: NavItem,
): boolean {
  if (item.deferred) return false;
  if (item.href === "/") return pathname === "/";

  const itemPath = item.href.split("?")[0];

  if (item.matchQuery) {
    if (pathname !== itemPath && !pathname.startsWith(itemPath + "/")) return false;
    for (const [key, val] of Object.entries(item.matchQuery)) {
      if (searchParams.get(key) !== val) return false;
    }
    return true;
  }

  if (itemPath === "/orgs") {
    return (pathname === "/orgs" || pathname.startsWith("/orgs/")) && !searchParams.has("type");
  }

  return pathname.startsWith(itemPath);
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-[2px] text-[#C7D2E5]/50 uppercase select-none"
       style={{ fontFamily: "'Inter', sans-serif" }}>
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
  const active = isActive(pathname, searchParams, item);

  if (item.deferred) {
    return (
      <span className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[#8a97a8] cursor-default select-none">
        <Image src={item.icon} alt="" width={16} height={16} className="shrink-0 opacity-40 brightness-0 invert" />
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
          ? "bg-[var(--mim-info)] text-white shadow-sm shadow-blue-600/20"
          : "text-white hover:bg-[var(--mim-sidebar-hover)] hover:text-white"
        }
      `}
      style={{ fontFamily: "'Geist', sans-serif" }}
    >
      <Image
        src={item.icon}
        alt=""
        width={16}
        height={16}
        className={`shrink-0 transition-all brightness-0 invert ${active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
      />
      <span className="truncate capitalize">{item.label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
      )}
    </Link>
  );
}

function NavSectionBlock({
  section,
  pathname,
  searchParams,
}: {
  section: NavSection;
  pathname: string;
  searchParams: URLSearchParams;
}) {
  return (
    <div>
      <SectionLabel label={section.label} />
      <div className="space-y-0.5 px-2">
        {section.items
          .filter((item) => !item.deferred)
          .map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} searchParams={searchParams} />
          ))}
      </div>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────────────────────────────── */

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSignOut() {
    window.location.href = "/login";
  }

  return (
    <aside className="w-[304px] flex flex-col shrink-0" style={{ backgroundColor: "var(--mim-system)" }}>

      {/* ── Logo ── */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Image src="/icons/MiMbrain Icon.png" alt="MiM" width={50} height={36} className="shrink-0" />
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-1 px-2 scrollbar-none">
        <NavSectionBlock section={SECTION_PERSONAL}  pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_ORGS}      pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_PEOPLE}    pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_PIPELINES} pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_TOOLS}     pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_SETTINGS}  pathname={pathname} searchParams={searchParams} />
        <div className="h-4" />
      </nav>

      {/* ── User profile + sign out ── */}
      <div className="p-3" style={{ backgroundColor: "var(--mim-user-bar)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full overflow-hidden shrink-0">
              <Image src="/icons/Ellipse 2831.png" alt="Mark Slater" width={44} height={44} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-medium text-[var(--mim-system)] leading-5" style={{ fontFamily: "'Inter', sans-serif" }}>Mark Slater</p>
              <p className="text-xs font-medium text-white leading-[14px]" style={{ fontFamily: "'Inter', sans-serif" }}>Co-Founder and CEO</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-0.5 px-3 py-1.5 rounded-md bg-white/30 text-[10px] font-semibold text-[var(--mim-system)] hover:bg-white/40 transition-colors"
            title="Log Out"
            style={{ fontFamily: "'Geist', sans-serif" }}
          >
            Log Out
            <Image src="/icons/account settings.png" alt="" width={16} height={16} className="brightness-0 opacity-70" />
          </button>
        </div>
      </div>
      <div className="py-3" style={{ backgroundColor: "var(--mim-system)" }}>
        <p className="text-sm font-semibold text-[#8598a8] text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
          Made In Motion PBC
        </p>
        <p className="text-xs font-normal text-[#8598a8] text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
          Built In Boston. 2026.
        </p>
      </div>

    </aside>
  );
}
