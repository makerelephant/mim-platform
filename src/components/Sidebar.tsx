"use client";

/**
 * Motion route sidebar — nav with per-item icons.
 * lg+: full card with labels (Figma-inspired). <lg: icon-only rail to free center width.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Cog, LayoutGrid, MessageSquareText, UserRound } from "lucide-react";

/* eslint-disable @next/next/no-img-element */

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Motion", Icon: LayoutGrid },
  { href: "/clearing", label: "Canvas", Icon: MessageSquareText },
  { href: "/engine", label: "Engine", Icon: Cog },
  { href: "/me", label: "Me", Icon: UserRound },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <aside
      className="fixed left-3 top-1/2 z-50 -translate-y-1/2 lg:left-[47px]"
      aria-label="Primary navigation"
    >
      <div className="relative w-[52px] overflow-hidden rounded-[8px] bg-white shadow-[0px_0px_40px_0px_rgba(0,0,0,0.08)] transition-[width] duration-200 ease-out lg:w-[169px]">
        {/* Collapsed rail */}
        <div className="flex w-[52px] flex-col items-center gap-1 py-3 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`flex h-10 w-10 items-center justify-center rounded-[6px] transition-colors ${
                  active
                    ? "bg-[#3e4c60]/60 text-white"
                    : "text-[#1e252a] hover:bg-black/[0.04]"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              </Link>
            );
          })}
          <div className="mt-2 flex w-full justify-center border-t border-[#e9e9e9] pt-3">
            <img
              src="/icons/MiMbrain Icon.png"
              alt=""
              className="h-[22px] w-auto opacity-80"
            />
          </div>
        </div>

        {/* Expanded card (lg+) */}
        <div
          className="relative hidden h-[432px] w-[169px] lg:block"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div
            className="absolute flex flex-col items-start"
            style={{ left: "11px", top: "16px", width: "137px" }}
          >
            <div className="flex w-full flex-col items-start gap-[2px] pl-[6px]">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative flex h-10 w-full items-center"
                    title={item.label}
                  >
                    {active && (
                      <div
                        className="absolute rounded-br-[18px] rounded-tr-[18px]"
                        style={{
                          backgroundColor: "#3e4c60",
                          opacity: 0.6,
                          height: "40px",
                          width: "137px",
                          left: "-6px",
                          top: "0px",
                        }}
                      />
                    )}
                    <span
                      className="relative flex h-10 w-full items-center gap-[8px] capitalize whitespace-nowrap"
                      style={{
                        fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        lineHeight: "18px",
                        letterSpacing: "-0.36px",
                        color: active ? "white" : "#1e252a",
                      }}
                    >
                      <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div
            className="absolute flex flex-col items-start gap-[2px]"
            style={{ left: "11px", top: "299px", width: "142px" }}
          >
            <div className="flex w-full items-end justify-between">
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
            <div className="flex w-full items-end justify-between">
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

          <div
            className="absolute flex flex-col items-start gap-[12px]"
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
      </div>
    </aside>
  );
}
