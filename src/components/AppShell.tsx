"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";

/** Routes that should NOT show the sidebar */
const BARE_ROUTES = new Set(["/login"]);

/** Routes that use the old CRM layout (dark sidebar) */
const LEGACY_ROUTES = [
  "/brain", "/tasks", "/orgs", "/contacts", "/people",
  "/pipeline", "/outreach", "/activity", "/intelligence",
  "/knowledge", "/news-sentiment", "/applications",
  "/settings", "/decisions",
];

function isLegacyRoute(pathname: string): boolean {
  return LEGACY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  // Legacy CRM pages — render without the new sidebar
  if (isLegacyRoute(pathname)) {
    return (
      <div className="flex h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#f3f3f3] p-4 sm:p-6">
          {children}
        </main>
      </div>
    );
  }

  // New Motion layout — minimal floating sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f5f5]">
      <Suspense>
        <Sidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
