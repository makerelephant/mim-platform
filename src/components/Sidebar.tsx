"use client";

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
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/investors", label: "Investors", icon: TrendingUp },
  { href: "/market-map", label: "Market Map", icon: Map },
  { href: "/soccer-orgs", label: "Soccer Orgs", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/activity", label: "Activity Log", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-tight">MiM Platform</h1>
        <p className="text-xs text-gray-400 mt-1">Made in Motion</p>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
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
