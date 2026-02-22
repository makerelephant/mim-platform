"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Search } from "lucide-react";

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
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("transactions").select("*").order("investment_date", { ascending: false, nullsFirst: false });
      if (data) setTransactions(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.company?.toLowerCase().includes(s) || t.sector?.toLowerCase().includes(s) || t.transaction_type?.toLowerCase().includes(s);
  });

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">{transactions.length} deals</p>
        </div>
      </div>

      <div className="mb-4 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search deals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Sector</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Sport</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Geography</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/transactions/${t.id}`} className="text-blue-600 hover:underline font-medium">{t.company}</Link>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {t.amount ? `$${(t.amount / 1000000).toFixed(1)}M` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {t.transaction_type && <Badge variant="secondary">{t.transaction_type}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{t.sector || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{t.sport || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{t.investment_date || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{t.geography || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{t.investment_stage || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
