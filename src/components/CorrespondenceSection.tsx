"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowUpRight, ArrowDownLeft, MessageSquare } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

interface CorrespondenceItem {
  id: string;
  direction: string | null;
  subject: string | null;
  snippet: string | null;
  sender_email: string | null;
  sender_name: string | null;
  recipient_email: string | null;
  email_date: string | null;
  source: string | null;
}

export function CorrespondenceSection({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const [items, setItems] = useState<CorrespondenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("correspondence")
        .select("id, direction, subject, snippet, sender_email, sender_name, recipient_email, email_date, source")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("email_date", { ascending: false })
        .limit(50);
      if (data) setItems(data);
      setLoading(false);
    }
    load();
  }, [entityType, entityId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Correspondence
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400">No correspondence yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  {item.source === "slack" ? (
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  ) : item.direction === "outbound" ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate flex-1">
                    {item.subject || "(no subject)"}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {timeAgo(item.email_date)}
                  </span>
                </div>
                {item.snippet && (
                  <p className="text-xs text-gray-500 line-clamp-2 ml-5.5 pl-0.5">
                    {item.snippet}
                  </p>
                )}
                <div className="text-[11px] text-gray-400 mt-1 ml-5.5 pl-0.5">
                  {item.direction === "outbound"
                    ? `To: ${item.recipient_email || "—"}`
                    : `From: ${item.sender_name || item.sender_email || "—"}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
