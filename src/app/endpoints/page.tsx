"use client";

import { Construction } from "lucide-react";

export default function EndpointsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Construction className="h-12 w-12 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">End Points</h1>
      <p className="text-gray-500 max-w-md">
        API endpoint management is coming soon. Configure and monitor your
        integration endpoints here.
      </p>
    </div>
  );
}
