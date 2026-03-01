"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { labels } from "@/config/labels";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Handshake,
  Building2,
  ArrowRightLeft,
  CheckSquare,
  Activity,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Globe,
  MessageSquareWarning,
  Newspaper,
  BookOpen,
  Send,
  Bot,
  type LucideIcon,
} from "lucide-react";

/* ── Types ── */

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

interface SuperCategory {
  label: string;
  entries: NavEntry[];
  comingSoon?: boolean;
}

interface SidebarConfig {
  topItems: NavItem[];
  categories: SuperCategory[];
}

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

/* ── Navigation config ── */

const sidebarConfig: SidebarConfig = {
  topItems: [
    { href: "/", label: labels.dashboard, icon: LayoutDashboard },
  ],
  categories: [
    {
      label: labels.superConversations,
      entries: [
        { href: "/contacts", label: labels.contacts, icon: Users },
        { href: "/tasks", label: labels.tasks, icon: CheckSquare },
        { href: "/support-issues", label: labels.supportIssues, icon: MessageSquareWarning },
      ],
    },
    {
      label: labels.superOrganizations,
      entries: [
        {
          label: labels.investorGroup,
          icon: TrendingUp,
          children: [
            { href: "/investors", label: labels.investors, icon: TrendingUp },
            { href: "/pipeline", label: labels.pipeline, icon: GitBranch },
            { href: "/transactions", label: labels.transactions, icon: ArrowRightLeft },
          ],
        },
        {
          label: labels.communitiesGroup,
          icon: Globe,
          children: [
            { href: "/soccer-orgs", label: labels.soccerOrgs, icon: Building2 },
            { href: "/channel-partners", label: labels.channelPartners, icon: Handshake },
          ],
        },
      ],
    },
    {
      label: labels.superContent,
      entries: [
        { href: "/news-sentiment", label: labels.newsSentiment, icon: Newspaper },
        { href: "/research", label: labels.research, icon: BookOpen },
        { href: "/outreach", label: labels.outreach, icon: Send },
      ],
    },
    {
      label: labels.superOrchestrations,
      entries: [
        { href: "/activity", label: labels.activityLog, icon: Activity },
      ],
    },
    {
      label: labels.superAccount,
      entries: [],
      comingSoon: true,
    },
    {
      label: labels.superEndPoints,
      entries: [],
      comingSoon: true,
    },
    {
      label: labels.superApplications,
      entries: [
        { href: "/applications", label: labels.applications, icon: Bot },
      ],
    },
  ],
};

/* ── Helpers ── */

function groupIsActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((child) => pathname.startsWith(child.href) && child.href !== "/");
}

/* ── Component ── */

export function Sidebar() {
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    sidebarConfig.categories.forEach((cat) => {
      cat.entries.forEach((entry) => {
        if (isGroup(entry) && groupIsActive(entry, pathname)) {
          initial.add(entry.label);
        }
      });
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

  const renderNavItem = (item: NavItem) => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  const renderNavGroup = (group: NavGroup) => {
    const isOpen = openGroups.has(group.label);
    const active = groupIsActive(group, pathname);
    const Icon = group.icon;
    const Chevron = isOpen ? ChevronDown : ChevronRight;

    return (
      <div key={group.label}>
        <button
          onClick={() => toggleGroup(group.label)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            active && !isOpen
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{group.label}</span>
          <Chevron className="h-3.5 w-3.5 text-gray-500" />
        </button>
        {isOpen && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-700 pl-3">
            {group.children.map((child) => {
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
  };

  const renderSuperCategory = (category: SuperCategory, index: number) => {
    return (
      <div key={category.label} className={index === 0 ? "mt-4" : "mt-5"}>
        {/* Section header */}
        <div className="flex items-center justify-between px-3 mb-1.5 pt-3 border-t border-gray-700/50">
          <span
            className={`text-[10px] font-semibold tracking-wider uppercase ${
              category.comingSoon ? "text-gray-600" : "text-gray-500"
            }`}
          >
            {category.label}
          </span>
          {category.comingSoon && (
            <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              Soon
            </span>
          )}
        </div>

        {/* Section entries */}
        {!category.comingSoon && (
          <div className="space-y-0.5">
            {category.entries.map((entry) =>
              isGroup(entry) ? renderNavGroup(entry) : renderNavItem(entry)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-gray-700">
        <Image src="/logo.png" alt="Every Step Together" width={220} height={22} priority />
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
        {/* Dashboard — always at top */}
        {sidebarConfig.topItems.map((item) => renderNavItem(item))}

        {/* Super categories */}
        {sidebarConfig.categories.map((category, index) =>
          renderSuperCategory(category, index)
        )}
      </nav>
      <div className="p-4 border-t border-gray-700 flex items-center justify-center">
        <Image src="/mim-logo.png" alt="Made in Motion" width={160} height={33} />
      </div>
    </aside>
  );
}
