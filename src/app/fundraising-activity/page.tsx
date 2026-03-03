"use client";

import { labels } from "@/config/labels";
import { Construction } from "lucide-react";

export default function FundraisingActivityPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Construction className="h-12 w-12 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Fundraising {labels.fundraisingActivity}
      </h1>
      <p className="text-gray-500 max-w-md">
        Track fundraising-specific activity and interactions. This page will show
        meetings, emails, and notes related to investor engagements.
      </p>
    </div>
  );
}
