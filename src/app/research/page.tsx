"use client";

import { Card, CardContent } from "@/components/ui/card";
import { labels } from "@/config/labels";
import { BookOpen } from "lucide-react";

export default function ResearchPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {labels.researchPageTitle}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Inbound research and reports
        </p>
      </div>
      <Card>
        <CardContent className="py-16 text-center">
          <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Coming Soon</p>
          <p className="text-gray-400 text-sm mt-1">
            Research documents and report tracking will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
