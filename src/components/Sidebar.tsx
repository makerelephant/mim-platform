"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Map,
  Building2,
  ArrowRightLeft,
  CheckSquare,
  Activity,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Globe,
  MessageSquareWarning,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const nav: NavEntry[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  {
    label: "Investors",
    icon: TrendingUp,
    children: [
      { href: "/investors", label: "All Investors", icon: TrendingUp },
      { href: "/pipeline", label: "Pipeline", icon: GitBranch },
      { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Communities",
    icon: Globe,
    children: [
      { href: "/soccer-orgs", label: "Soccer Orgs", icon: Building2 },
      { href: "/market-map", label: "Market Map", icon: Map },
    ],
  },
  { href: "/support-issues", label: "Support Issues", icon: MessageSquareWarning },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/activity", label: "Activity Log", icon: Activity },
];

function groupIsActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((child) => pathname.startsWith(child.href) && child.href !== "/");
}

export function Sidebar() {
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    nav.forEach((entry) => {
      if (isGroup(entry) && groupIsActive(entry, pathname)) {
        initial.add(entry.label);
      }
    });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-tight">MiM Platform</h1>
        <p className="text-xs text-gray-400 mt-1">Made in Motion</p>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
        {nav.map((entry) => {
          if (isGroup(entry)) {
            const isOpen = openGroups.has(entry.label);
            const active = groupIsActive(entry, pathname);
            const Icon = entry.icon;
            const Chevron = isOpen ? ChevronDown : ChevronRight;

            return (
              <div key={entry.label}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active && !isOpen
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{entry.label}</span>
                  <Chevron className="h-3.5 w-3.5 text-gray-500" />
                </button>
                {isOpen && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-700 pl-3">
                    {entry.children.map((child) => {
                      const childActive = pathname.startsWith(child.href) && child.href !== "/";
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            childActive
                              ? "bg-blue-600 text-white font-medium"
                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          }`}
                        >
                          <ChildIcon className="h-3.5 w-3.5" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const { href, label, icon: Icon } = entry;
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">v1.0 — MiM Platform</p>
      </div>
    </aside>
  );
}
