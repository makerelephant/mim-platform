"use client";

import { useState, useEffect } from "react";
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
  CheckSquare,
  Activity,
  GitBranch,
  Globe,
  MessageSquareWarning,
  Newspaper,
  BookOpen,
  Bot,
  Grid3X3,
  UserCheck,
  Shield,
  Palette,
  Send,
  Plug,
  Database,
  Lock,
  History,
  ChevronDown,
  ChevronRight,
  Building,
  Brain,
  BarChart3,
  Library,
  type LucideIcon,
} from "lucide-react";

/* ── Types ── */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  deferred?: boolean;
}

interface SuperCategory {
  label: string;
  items: NavItem[];
  deferred?: boolean;
}

/* ── Navigation config ── */

const topItems: NavItem[] = [
  { href: "/", label: labels.dashboard, icon: LayoutDashboard },
  { href: "/all-orgs", label: "All Organizations", icon: Building },
];

const categories: SuperCategory[] = [
  {
    label: labels.superFundraising,
    items: [
      { href: "/investors", label: labels.investors, icon: TrendingUp },
      { href: "/investor-contacts", label: labels.investorContacts, icon: UserCheck },
      { href: "/pipeline", label: labels.fundraisingPipeline, icon: GitBranch },
      { href: "/fundraising-activity", label: labels.fundraisingActivity, icon: Activity },
      { href: "/fundraising/tasks", label: labels.fundraisingTasks, icon: CheckSquare, deferred: true },
    ],
  },
  {
    label: labels.superPartnerships,
    items: [
      { href: "/channel-partners", label: labels.partnerOrgs, icon: Building2 },
      { href: "/partnerships/assignments", label: labels.partnerCategories, icon: Grid3X3 },
      { href: "/partnerships/pipeline", label: labels.partnershipPipeline, icon: Handshake },
      { href: "/partnerships/activities", label: labels.partnershipActivities, icon: Activity, deferred: true },
      { href: "/partnerships/tasks", label: labels.partnershipTasks, icon: CheckSquare, deferred: true },
    ],
  },
  {
    label: labels.superCommunities,
    items: [
      { href: "/soccer-orgs", label: labels.allCommunities, icon: Globe },
      { href: "/communities/categories", label: labels.communityCategories, icon: Grid3X3 },
      { href: "/communities/activities", label: labels.communityActivities, icon: Activity, deferred: true },
      { href: "/communities/tasks", label: labels.communityTasks, icon: CheckSquare, deferred: true },
    ],
  },
  {
    label: labels.superActivity,
    items: [
      { href: "/tasks", label: labels.tasks, icon: CheckSquare },
      { href: "/support-issues", label: labels.supportIssues, icon: MessageSquareWarning },
      { href: "/activity", label: labels.activityLog, icon: History },
    ],
  },
  {
    label: labels.superPeople,
    items: [
      { href: "/contacts", label: labels.contacts, icon: Users },
      { href: "/people/roles", label: labels.roles, icon: Shield },
      { href: "/people/creators", label: labels.creators, icon: Palette, deferred: true },
    ],
  },
  {
    label: labels.superSentiment,
    items: [
      { href: "/news-sentiment", label: labels.newsSentiment, icon: Newspaper },
      { href: "/research", label: labels.research, icon: BookOpen },
    ],
  },
  {
    label: labels.superGophers,
    items: [
      { href: "/applications", label: labels.gophers, icon: Bot },
      { href: "/intelligence", label: labels.intelligence, icon: BarChart3 },
      { href: "/knowledge", label: labels.knowledgeBase, icon: Library },
      { href: "/campaigns", label: labels.campaigns, icon: Send, deferred: true },
      { href: "/endpoints", label: labels.endPoints, icon: Plug, deferred: true },
    ],
  },
  {
    label: labels.superSettings,
    items: [
      { href: "/settings/taxonomy", label: labels.taxonomy, icon: Brain },
      { href: "/settings/fields", label: labels.fieldsEnums, icon: Database, deferred: true },
      { href: "/settings/integrations", label: labels.integrations, icon: Plug, deferred: true },
      { href: "/settings/users", label: labels.usersPermissions, icon: Lock, deferred: true },
    ],
  },
];

/* ── Component ── */

export function Sidebar() {
  const pathname = usePathname();

  // Determine which categories should be open based on current route
  const getInitialOpen = (): Set<string> => {
    const open = new Set<string>();
    for (const cat of categories) {
      for (const item of cat.items) {
        if (!item.deferred) {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          if (active) {
            open.add(cat.label);
            break;
          }
        }
      }
    }
    return open;
  };

  const [openCategories, setOpenCategories] = useState<Set<string>>(getInitialOpen);

  // Update open categories when route changes
  useEffect(() => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      for (const cat of categories) {
        for (const item of cat.items) {
          if (!item.deferred) {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            if (active) {
              next.add(cat.label);
              break;
            }
          }
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleCategory = (label: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem) => {
    if (item.deferred) {
      const Icon = item.icon;
      return (
        <span
          key={item.href}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 cursor-default"
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </span>
      );
    }

    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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

  const renderSuperCategory = (category: SuperCategory, index: number) => {
    const allDeferred = category.deferred || category.items.every((i) => i.deferred);
    const isOpen = openCategories.has(category.label);

    // Check if any item in this category is active
    const hasActiveItem = category.items.some((item) => {
      if (item.deferred) return false;
      return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    });

    return (
      <div key={category.label} className={index === 0 ? "mt-3" : "mt-1"}>
        {/* Section header — clickable to expand/collapse */}
        <button
          onClick={() => !allDeferred && toggleCategory(category.label)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
            allDeferred
              ? "cursor-default"
              : "cursor-pointer hover:bg-gray-800/50"
          } ${hasActiveItem && !isOpen ? "bg-gray-800/30" : ""}`}
        >
          <span
            className={`text-sm font-medium ${
              allDeferred ? "text-gray-600" : hasActiveItem ? "text-blue-400" : "text-gray-300"
            }`}
          >
            {category.label}
          </span>
          <div className="flex items-center gap-1.5">
            {allDeferred && (
              <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                Soon
              </span>
            )}
            {!allDeferred && (
              isOpen ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500" />
              )
            )}
          </div>
        </button>

        {/* Section items — collapsible */}
        {!allDeferred && isOpen && (
          <div className="space-y-0.5 mt-0.5">
            {category.items.map((item) => renderNavItem(item))}
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
        {/* Dashboard + All Orgs — always at top */}
        {topItems.map((item) => renderNavItem(item))}

        {/* Super categories — collapsible */}
        {categories.map((category, index) =>
          renderSuperCategory(category, index)
        )}
      </nav>
      <div className="p-4 border-t border-gray-700 flex items-center justify-center">
        <Image src="/mim-logo.png" alt="Made in Motion" width={160} height={33} />
      </div>
    </aside>
  );
}
