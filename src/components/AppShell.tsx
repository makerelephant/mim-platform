"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";

/** Routes that should NOT show the sidebar */
const BARE_ROUTES = new Set(["/login"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense>
        <Sidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
