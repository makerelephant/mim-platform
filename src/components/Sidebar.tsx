"use client";

/**
 * Sidebar — Pixel-perfect match to Figma node 94:4010
 * lg+: expanded card (169px) with labels + icons. <lg: icon-only rail.
 * Active state: #289bff blue. Semi-transparent white bg with glass effect.
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* eslint-disable @next/next/no-img-element */

const geist = "var(--font-geist-sans), 'Geist', sans-serif";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  iconSm?: string; // collapsed version icon (if different)
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Motion", icon: "/icons/sidebar-motion.svg" },
  { href: "/clearing", label: "Canvas", icon: "/icons/sidebar-canvas.svg", iconSm: "/icons/sidebar-canvas-sm.svg" },
  { href: "/engine", label: "Engine", icon: "/icons/sidebar-engine.svg" },
  { href: "/me", label: "Me", icon: "/icons/sidebar-ghost.svg" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function isActive(item: NavItem): boolean {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  // Close menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAccountMenu]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // still redirect even if the call fails
    }
    router.push("/login");
  }

  return (
    <aside
      className="fixed left-3 top-1/2 z-50 -translate-y-1/2 lg:left-[50px]"
      aria-label="Primary navigation"
    >
      {/* ════════════════════════════════════════════════════════════
          COLLAPSED RAIL (< lg) — icon-only, transparent bg
          ════════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col items-center rounded-[12px] px-[14px] py-[12px] shadow-[0px_0px_40px_0px_rgba(0,0,0,0.08)] lg:hidden"
      >
        <div className="flex flex-col items-center gap-[5px]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const iconSrc = item.iconSm || item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className="relative"
              >
                {active && (
                  <div className="absolute inset-0 rounded-[4px] bg-[#289bff]" />
                )}
                <div className="relative flex items-center justify-center size-[18px]">
                  <img
                    src={iconSrc}
                    alt=""
                    className="size-[16px] shrink-0"
                    style={{ filter: active ? "brightness(0) invert(1)" : "brightness(0)" }}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* In Motion icon */}
        <div className="mt-[36px] flex items-center justify-center">
          <img
            src="/icons/MiMbrain Icon.png"
            alt="In Motion"
            className="w-[25px] h-[17.8px]"
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          EXPANDED CARD (lg+) — full nav with labels, Figma 94:4010
          ════════════════════════════════════════════════════════════ */}
      <div
        className="relative hidden h-[639px] w-[169px] rounded-[12px] shadow-[0px_0px_40px_0px_rgba(0,0,0,0.12)] lg:block"
        style={{
          backgroundColor: "rgba(255,255,255,0.4)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        {/* ── Tagline + separator ── */}
        <div
          className="absolute flex flex-col items-start"
          style={{ left: "9px", top: "16px", width: "152px" }}
        >
          <p
            className="w-[132px]"
            style={{
              fontFamily: geist,
              fontSize: "18px",
              fontWeight: 700,
              lineHeight: "20px",
              letterSpacing: "-0.9px",
              color: "#e9e9e9",
            }}
          >
            Every Step Together.
          </p>
          <div className="h-px w-[140px] mt-[16px]" style={{ backgroundColor: "#e0e0e0" }} />
        </div>

        {/* ── Nav items (icon LEFT of label) ── */}
        <div
          className="absolute flex flex-col items-start gap-[6px]"
          style={{ left: "9px", top: "96px", width: "152px" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex h-[22px] w-full items-center gap-[12px]"
                title={item.label}
              >
                {active && (
                  <div
                    className="absolute rounded-br-[18px] rounded-tr-[18px]"
                    style={{
                      backgroundColor: "#289bff",
                      height: "22px",
                      width: "162px",
                      left: "-6px",
                      top: "0px",
                    }}
                  />
                )}
                <img
                  src={item.icon}
                  alt=""
                  className="relative size-[16px] shrink-0"
                  style={{ filter: active ? "brightness(0) invert(1)" : "brightness(0)" }}
                />
                <span
                  className="relative capitalize whitespace-nowrap"
                  style={{
                    fontFamily: geist,
                    fontSize: "14px",
                    fontWeight: 500,
                    lineHeight: "18px",
                    letterSpacing: "-0.28px",
                    color: active ? "white" : "#1e252a",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Glossary / Technical Docs ── */}
        <div
          className="absolute flex flex-col items-start"
          style={{ left: "9px", top: "456px", width: "152px" }}
        >
          <div className="flex h-[18px] w-[112px] items-center justify-between">
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: geist,
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "12px",
                letterSpacing: "-0.24px",
                color: "#9ca5a9",
              }}
            >
              Glossary
            </span>
            <img
              src="/icons/sidebar-arrow-right.svg"
              alt=""
              className="shrink-0 size-[12px]"
            />
          </div>
          <div className="flex h-[18px] w-[112px] items-center justify-between">
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: geist,
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "12px",
                letterSpacing: "-0.24px",
                color: "#9ca5a9",
              }}
            >
              Technical Docs
            </span>
            <img
              src="/icons/sidebar-arrow-right.svg"
              alt=""
              className="shrink-0 size-[12px]"
            />
          </div>
        </div>

        {/* ── Account Settings (avatar + label) ── */}
        <div
          className="absolute flex flex-col items-start gap-[12px]"
          style={{ left: "9px", top: "530px", width: "152px" }}
        >
          <div className="relative w-full" ref={menuRef}>
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              className="flex items-center gap-[6px] cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: "none", border: "none", padding: 0 }}
            >
              <div className="w-[30px] h-[30px] rounded-full overflow-hidden shrink-0">
                <img
                  src="/icons/mark-avatar.png"
                  alt="Mark Slater"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className="whitespace-nowrap"
                style={{
                  fontFamily: geist,
                  fontSize: "14px",
                  fontWeight: 500,
                  lineHeight: "14px",
                  letterSpacing: "-0.28px",
                  color: "#3e4c60",
                }}
              >
                Account Settings
              </span>
            </button>

            {/* Dropdown menu */}
            {showAccountMenu && (
              <div
                className="absolute left-0 bottom-[40px] w-[160px] rounded-[8px] shadow-[0px_4px_20px_rgba(0,0,0,0.12)] overflow-hidden z-50"
                style={{
                  backgroundColor: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                {/* User info */}
                <div className="px-[12px] py-[10px] border-b border-[#e0e0e0]">
                  <p
                    style={{
                      fontFamily: geist,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#1e252a",
                      lineHeight: "14px",
                    }}
                  >
                    Mark Slater
                  </p>
                  <p
                    style={{
                      fontFamily: geist,
                      fontSize: "10px",
                      fontWeight: 400,
                      color: "#9ca5a9",
                      lineHeight: "14px",
                    }}
                  >
                    CEO
                  </p>
                </div>

                {/* Log Out button */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-[8px] px-[12px] py-[8px] hover:bg-[#f6f5f5] transition-colors cursor-pointer"
                  style={{ background: "none", border: "none" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span
                    style={{
                      fontFamily: geist,
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#e53e3e",
                      lineHeight: "14px",
                    }}
                  >
                    {loggingOut ? "Logging out..." : "Log Out"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ── Separator + In Motion + Release ── */}
          <div className="h-px w-[141px]" style={{ backgroundColor: "#e0e0e0" }} />
          <div className="flex items-end gap-[45px] w-full">
            <div className="flex items-center shrink-0">
              <img
                src="/icons/MiMbrain Icon.png"
                alt="In Motion"
                className="w-[25px] h-[17.8px]"
              />
            </div>
            <span
              className="whitespace-nowrap shrink-0"
              style={{
                fontFamily: geist,
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "12px",
                letterSpacing: "-0.24px",
                color: "#289bff",
              }}
            >
              Release V.0.1
            </span>
          </div>
        </div>
      </div>

      {/* ── Copyright — outside the card ── */}
      <p
        className="mt-[8px] hidden lg:block"
        style={{
          fontFamily: geist,
          fontSize: "10px",
          fontWeight: 500,
          lineHeight: "14px",
          letterSpacing: "0px",
          color: "#1e252a",
        }}
      >
        ©️ Made In Motion PBC, 2026.
      </p>
    </aside>
  );
}
