"use client";

import { Construction } from "lucide-react";

export default function CampaignsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Construction className="h-12 w-12 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaigns</h1>
      <p className="text-gray-500 max-w-md">
        Campaign management is coming soon. You&apos;ll be able to create, manage, and
        track outreach campaigns across your organization.
      </p>
    </div>
  );
}
