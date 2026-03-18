"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { LegacySidebar } from "@/components/LegacySidebar";
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

  // New Motion layout — sidebar floats over full-width content
  if (isMotionRoute(pathname)) {
    return (
      <div className="relative h-screen overflow-hidden bg-[#f6f5f5]">
        <main className="h-full w-full overflow-y-auto">
          {children}
        </main>
        <Suspense>
          <Sidebar />
        </Suspense>
      </div>
    );
  }

  // Everything else — old dark sidebar
  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense>
        <LegacySidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto bg-[#f3f3f3] p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
