"use client";

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
  Link as LinkIcon,
  Camera,
  Map,
  Palette,
  Send,
  Plug,
  Database,
  Settings,
  Lock,
  History,
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
];

const categories: SuperCategory[] = [
  {
    label: labels.superFundraising,
    items: [
      { href: "/pipeline", label: labels.fundraisingPipeline, icon: GitBranch },
      { href: "/investors", label: labels.investors, icon: TrendingUp },
      { href: "/investor-contacts", label: labels.investorContacts, icon: UserCheck },
      { href: "/fundraising-activity", label: labels.fundraisingActivity, icon: Activity },
    ],
  },
  {
    label: labels.superPartnerships,
    items: [
      { href: "/channel-partners", label: labels.partnerOrgs, icon: Building2 },
      { href: "/partnerships/assignments", label: labels.categoryGeoAssignments, icon: Grid3X3 },
      { href: "/partnerships/pipeline", label: labels.partnershipPipeline, icon: Handshake },
    ],
  },
  {
    label: labels.superCommunities,
    items: [
      { href: "/soccer-orgs", label: labels.allCommunities, icon: Globe },
      { href: "/communities/share-links", label: labels.shareLinks, icon: LinkIcon, deferred: true },
      { href: "/communities/moments", label: labels.moments, icon: Camera, deferred: true },
      { href: "/communities/org-map", label: labels.communityOrgMap, icon: Map, deferred: true },
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
    label: labels.superOrchestrations,
    items: [
      { href: "/applications", label: labels.applications, icon: Bot },
      { href: "/campaigns", label: labels.campaigns, icon: Send, deferred: true },
      { href: "/endpoints", label: labels.endPoints, icon: Plug, deferred: true },
    ],
  },
  {
    label: labels.superSettings,
    items: [
      { href: "/settings/fields", label: labels.fieldsEnums, icon: Database, deferred: true },
      { href: "/settings/integrations", label: labels.integrations, icon: Plug, deferred: true },
      { href: "/settings/users", label: labels.usersPermissions, icon: Lock, deferred: true },
    ],
    deferred: true,
  },
];

/* ── Component ── */

export function Sidebar() {
  const pathname = usePathname();

  const renderNavItem = (item: NavItem) => {
    if (item.deferred) {
      const Icon = item.icon;
      return (
        <span
          key={item.href}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 cursor-default"
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

  const renderSuperCategory = (category: SuperCategory, index: number) => {
    const allDeferred = category.deferred || category.items.every((i) => i.deferred);

    return (
      <div key={category.label} className={index === 0 ? "mt-4" : "mt-5"}>
        {/* Section header */}
        <div className="flex items-center justify-between px-3 mb-1.5 pt-3 border-t border-gray-700/50">
          <span
            className={`text-[10px] font-semibold tracking-wider uppercase ${
              allDeferred ? "text-gray-600" : "text-gray-500"
            }`}
          >
            {category.label}
          </span>
          {allDeferred && (
            <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              Soon
            </span>
          )}
        </div>

        {/* Section items */}
        {!allDeferred && (
          <div className="space-y-0.5">
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
        {/* Dashboard — always at top */}
        {topItems.map((item) => renderNavItem(item))}

        {/* Super categories */}
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
