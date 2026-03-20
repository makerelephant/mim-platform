"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { LegacySidebar } from "@/components/LegacySidebar";
import {
  LEGACY_PAGE_BACKGROUND_DEFAULT,
  MOTION_PAGE_BACKGROUND_DEFAULT,
  PageBackgroundProvider,
} from "@/components/PageBackgroundContext";
import { Suspense } from "react";

/** Routes that should NOT show any sidebar */
const BARE_ROUTES = new Set(["/login"]);

/** Routes that use the NEW Motion sidebar */
const MOTION_ROUTES = ["/", "/clearing", "/engine", "/me"];

function isMotionRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return MOTION_ROUTES.some((r) => r !== "/" && (pathname === r || pathname.startsWith(r + "/")));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  // Motion layout — full-viewport background + floating sidebar; main inset = nav + 24px gap
  if (isMotionRoute(pathname)) {
    return (
      <div className="relative h-screen overflow-hidden">
        <PageBackgroundProvider defaultSpec={MOTION_PAGE_BACKGROUND_DEFAULT}>
          <Suspense>
            <Sidebar />
          </Suspense>
          <main className="relative z-10 h-full w-full overflow-y-auto pl-[88px] lg:pl-[240px]">
            {children}
          </main>
        </PageBackgroundProvider>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden">
      <PageBackgroundProvider defaultSpec={LEGACY_PAGE_BACKGROUND_DEFAULT}>
        <div className="relative z-10 flex h-full min-h-0 min-w-0">
          <Suspense>
            <LegacySidebar />
          </Suspense>
          <main className="min-h-0 flex-1 overflow-y-auto bg-transparent p-4 sm:p-6">
            {children}
          </main>
        </div>
      </PageBackgroundProvider>
    </div>
  );
}
