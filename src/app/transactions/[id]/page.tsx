"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface Transaction {
  id: string;
  company: string;
  amount: number | null;
  company_link: string | null;
  geography: string | null;
  investment_date: string | null;
  investment_stage: string | null;
  investors_buyers: string | null;
  sector: string | null;
  sport: string | null;
  transaction_type: string | null;
  annual_revenue: number | null;
  press_link: string | null;
  press_notes: string | null;
}

export default function TransactionDetail() {
  const params = useParams();
  const router = useRouter();
  const [tx, setTx] = useState<Transaction | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("transactions").select("*").eq("id", params.id as string).single();
      if (data) setTx(data);
    }
    load();
  }, [params.id]);

  if (!tx) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tx.company}</h1>
          <div className="flex gap-2 mt-2">
            {tx.transaction_type && <Badge variant="secondary">{tx.transaction_type}</Badge>}
            {tx.sport && <Badge variant="outline">{tx.sport}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {tx.company_link && (
            <a href={tx.company_link.startsWith("http") ? tx.company_link : `https://${tx.company_link}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Company</Button>
            </a>
          )}
          {tx.press_link && (
            <a href={tx.press_link} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Press</Button>
            </a>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Deal Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-xs text-gray-500">Amount</span><p className="font-medium">{tx.amount ? `$${tx.amount.toLocaleString()}` : "—"}</p></div>
            <div><span className="text-xs text-gray-500">Date</span><p>{tx.investment_date || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Transaction Type</span><p>{tx.transaction_type || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Investment Stage</span><p>{tx.investment_stage || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Sector</span><p>{tx.sector || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Sport</span><p>{tx.sport || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Geography</span><p>{tx.geography || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Annual Revenue</span><p>{tx.annual_revenue ? `$${tx.annual_revenue.toLocaleString()}` : "—"}</p></div>
            <div className="col-span-2"><span className="text-xs text-gray-500">Investors / Buyers</span><p>{tx.investors_buyers || "—"}</p></div>
            {tx.press_notes && <div className="col-span-2"><span className="text-xs text-gray-500">Notes</span><p className="whitespace-pre-wrap">{tx.press_notes}</p></div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
