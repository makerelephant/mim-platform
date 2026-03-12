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
    { href: "/",      label: "My Brain", icon: "/icons/Brain Icon.png" },
    { href: "/tasks", label: "My Tasks", icon: "/icons/Tasks Icon.png" },
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
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase select-none">
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
        group flex items-center gap-3 px-3 py-[7px] rounded-lg text-sm font-medium
        transition-all duration-100
        ${active
          ? "bg-[#4B8BF5] text-white shadow-sm shadow-blue-600/20"
          : "text-[#c8d0da] hover:bg-[#4a5a70] hover:text-white"
        }
      `}
    >
      <Image
        src={item.icon}
        alt=""
        width={16}
        height={16}
        className={`shrink-0 transition-all brightness-0 invert ${active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
      />
      <span className="truncate">{item.label}</span>
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
    <aside className="w-56 flex flex-col shrink-0" style={{ backgroundColor: "#3E4C60" }}>

      {/* ── Logo ── */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Image src="/icons/MiMbrain Icon.png" alt="MiM" width={28} height={28} className="shrink-0" />
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-1 scrollbar-none">
        <NavSectionBlock section={SECTION_PERSONAL}  pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_ORGS}      pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_PEOPLE}    pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_PIPELINES} pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_TOOLS}     pathname={pathname} searchParams={searchParams} />
        <NavSectionBlock section={SECTION_SETTINGS}  pathname={pathname} searchParams={searchParams} />
        <div className="h-4" />
      </nav>

      {/* ── User profile + sign out ── */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-1 mb-2">
          <div className="h-9 w-9 rounded-full overflow-hidden shrink-0">
            <Image src="/icons/Ellipse 2831.png" alt="Mark Slater" width={36} height={36} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">Mark Slater</p>
            <p className="text-[11px] text-[#8a97a8] truncate">Co-Founder and CEO</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[#8a97a8] hover:bg-[#4a5a70] hover:text-white transition-colors"
            title="Log Out"
          >
            Log Out
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[#6b7a8d] text-center mt-2">
          Made In Motion PBC<br />
          Built in Boston. 2026.
        </p>
      </div>

    </aside>
  );
}
