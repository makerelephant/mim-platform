"use client";

/**
 * MiMbrain Sidebar — Motion Design
 * src/components/Sidebar.tsx
 *
 * Minimal floating nav: avatar, 4 nav items, MiMBrain icon, tagline.
 * Matches Figma node 5:3848.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Navigation ───────────────────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",         label: "Motion" },
  { href: "/clearing", label: "Clearing" },
  { href: "/engine",   label: "Engine" },
  { href: "/me",       label: "Me" },
];

/* ── Sidebar ──────────────────────────────────────────────────────────────── */

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.href === "/") return pathname === "/";
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="flex flex-col items-center justify-between w-[200px] shrink-0 py-8 px-5">

      {/* ── Floating card ── */}
      <div className="w-full bg-white rounded-2xl shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)] flex flex-col items-start justify-between py-6 px-5 flex-1">

        {/* ── Avatar ── */}
        <div className="shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/Ellipse 2831.png"
              alt="Mark Slater"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* ── Nav Items ── */}
        <nav className="flex flex-col items-start gap-[18px] w-full">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative text-[20px] font-semibold capitalize tracking-[-0.6px] leading-6 transition-colors
                  ${active
                    ? "text-[#1e252a]"
                    : "text-[#1e252a]/60 hover:text-[#1e252a]/80"
                  }
                `}
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                {/* Active pill indicator */}
                {active && (
                  <span className="absolute -left-5 top-1/2 -translate-y-1/2 w-[calc(100%+40px)] h-[30px] bg-white rounded-r-[18px] rounded-br-[18px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)] -z-10" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── MiMBrain Icon ── */}
        <div className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/MiMbrain Icon.png"
            alt="MiMBrain"
            width={36}
            height={26}
            className="opacity-80"
          />
        </div>
      </div>

      {/* ── Tagline ── */}
      <p
        className="text-[18px] font-[800] text-[#3e4c60] opacity-40 tracking-[-0.9px] text-center mt-6 whitespace-nowrap"
        style={{ fontFamily: "'SF Pro Text', var(--font-geist-sans), sans-serif" }}
      >
        Every  Step Together.
      </p>
    </aside>
  );
}
