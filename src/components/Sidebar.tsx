"use client";

/**
 * MiMbrain Sidebar — Pixel-perfect Figma match (node 30:419)
 *
 * 175px outer container, 163px white card with rounded-12, heavy shadow.
 * Nav items: Motion/Clearing/Engine/Me at 14px Geist Medium.
 * Active state: #3e4c60 pill at 60% opacity, rounded-tr-18/br-18.
 * Bottom: Glossary + Technical Docs links, MiMbrain icon, copyright.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

/* eslint-disable @next/next/no-img-element */

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

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <aside
      className="fixed z-50"
      style={{ left: "47px", top: "50%", transform: "translateY(-50%)" }}
    >
      {/* ── White card container — 169px wide, 410px tall ── */}
      <div
        className="relative rounded-[12px]"
        style={{
          width: "169px",
          height: "410px",
          background: "rgba(255,255,255,0)",
          boxShadow: "0px 0px 40px 0px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── Navigation items — top-left ── */}
        <div
          className="absolute flex flex-col items-start"
          style={{ left: "11px", top: "16px", width: "137px" }}
        >
          <div className="flex flex-col gap-[2px] items-start pl-[6px] w-full">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative block w-full"
                >
                  {/* Active pill background */}
                  {active && (
                    <div
                      className="absolute rounded-tr-[18px] rounded-br-[18px]"
                      style={{
                        backgroundColor: "#3e4c60",
                        opacity: 0.6,
                        height: "18px",
                        width: "137px",
                        left: "-6px",
                        top: "0px",
                      }}
                    />
                  )}
                  <span
                    className="relative block capitalize whitespace-nowrap"
                    style={{
                      fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "18px",
                      letterSpacing: "-0.36px",
                      color: active ? "white" : "#1e252a",
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Glossary + Technical Docs links ── */}
        <div
          className="absolute flex flex-col gap-[2px] items-start"
          style={{ left: "11px", top: "299px", width: "142px" }}
        >
          {/* Glossary */}
          <div className="flex items-end justify-between w-full">
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                fontSize: "10px",
                fontWeight: 500,
                lineHeight: "12px",
                color: "#9ca5a9",
              }}
            >
              Glossary
            </span>
            <img
              src="/icons/arrow-right.svg"
              alt=""
              className="shrink-0"
              style={{ width: "9px", height: "9px" }}
            />
          </div>
          {/* Technical Docs */}
          <div className="flex items-end justify-between w-full">
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                fontSize: "10px",
                fontWeight: 500,
                lineHeight: "12px",
                color: "#9ca5a9",
              }}
            >
              Technical Docs
            </span>
            <img
              src="/icons/arrow-right.svg"
              alt=""
              className="shrink-0"
              style={{ width: "9px", height: "9px" }}
            />
          </div>
        </div>

        {/* ── MiMbrain icon + Copyright ── */}
        <div
          className="absolute flex flex-col gap-[12px] items-start"
          style={{ left: "17px", top: "346px", width: "142px" }}
        >
          <img
            src="/icons/MiMbrain Icon.png"
            alt="MiMBrain"
            style={{ width: "36px", height: "25.63px" }}
          />
          <p
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              fontSize: "10px",
              fontWeight: 500,
              lineHeight: "20px",
              color: "#3e4c60",
              letterSpacing: "0px",
            }}
          >
            © 2026 Made In Motion PBC
          </p>
        </div>
      </div>
    </aside>
  );
}
