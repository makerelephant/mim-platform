"use client";

import { Construction } from "lucide-react";

export default function MomentsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Construction className="h-12 w-12 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Moments</h1>
      <p className="text-gray-500 max-w-md">
        Capture and showcase community moments. Coming soon.
      </p>
    </div>
  );
}
