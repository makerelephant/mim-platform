"use client";

import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import Link from "next/link";

interface AlertItem {
  id: string;
  title: string;
  priority: string;
  entity_name?: string;
  source: string | null;
}

interface AlertBannerProps {
  items: AlertItem[];
}

export function AlertBanner({ items }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  const critical = visible.filter((i) => i.priority === "critical");
  const high = visible.filter((i) => i.priority === "high");

  // Show critical items in red, high in amber
  const topItems = [...critical, ...high].slice(0, 3);
  const isCritical = critical.length > 0;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 flex items-start gap-3 ${
        isCritical
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <AlertCircle
        className={`h-5 w-5 shrink-0 mt-0.5 ${isCritical ? "text-red-500" : "text-amber-500"}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCritical ? "text-red-800" : "text-amber-800"}`}>
          {critical.length > 0
            ? `${critical.length} critical alert${critical.length > 1 ? "s" : ""}`
            : `${high.length} high-priority item${high.length > 1 ? "s" : ""} need attention`}
        </p>
        <div className="mt-1 space-y-0.5">
          {topItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  item.priority === "critical" ? "bg-red-500" : "bg-amber-500"
                }`}
              />
              <Link
                href="/tasks"
                className={`hover:underline truncate ${
                  isCritical ? "text-red-700" : "text-amber-700"
                }`}
              >
                {item.entity_name ? `${item.entity_name}: ` : ""}
                {item.title}
              </Link>
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(item.id))}
                className="shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {visible.length > 3 && (
            <Link href="/tasks" className="text-xs text-gray-500 hover:underline mt-1 inline-block">
              +{visible.length - 3} more
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
