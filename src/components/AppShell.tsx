"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";

/** Routes that should NOT show any sidebar */
const BARE_ROUTES = new Set(["/login"]);

/** Routes that use the Motion sidebar */
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

  const showSidebar = isMotionRoute(pathname);

  return (
    <div className="relative h-screen overflow-hidden">
      {showSidebar && (
        <Suspense>
          <Sidebar />
        </Suspense>
      )}
      {/* ⚠️  CRITICAL: The sidebar is position:fixed. The padding-left on <main>
           pushes page content clear of it. The backgroundColor MUST be set here
           on <main> so the padded zone matches the page background — otherwise
           a visible empty column appears behind the semi-transparent sidebar.
           DO NOT REMOVE the backgroundColor or the padding-left. */}
      <main
        className={`relative h-full w-full overflow-y-auto ${
          showSidebar ? "pl-[60px] lg:pl-[250px]" : ""
        }`}
        style={showSidebar ? { backgroundColor: "#f6f5f5" } : undefined}
      >
        {children}
      </main>
    </div>
  );
}
