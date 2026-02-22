"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import Link from "next/link";
import { Search, X, Plus, Trash2, CheckSquare, Square } from "lucide-react";

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

const TRANSACTION_TYPES = ["Acquisition", "Fundraise", "Merger", "IPO", "Investment", "Partnership"];
const STAGES = ["Seed", "Series A", "Series B", "Series C", "Growth", "Late Stage", "Pre-IPO"];
const SPORTS = ["Soccer", "Basketball", "Football", "Baseball", "Hockey", "Multi-Sport", "Esports"];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newType, setNewType] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newSector, setNewSector] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("transactions").select("*").order("investment_date", { ascending: false, nullsFirst: false });
    if (data) setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const dbValue = field === "amount" || field === "annual_revenue" ? (value ? Number(value) : null) : (value || null);
    const { error } = await supabase.from("transactions").update({ [field]: dbValue }).eq("id", id);
    if (!error) setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: dbValue } : t)));
  };

  const createTransaction = async () => {
    if (!newCompany.trim()) return;
    const { data, error } = await supabase.from("transactions").insert({
      company: newCompany,
      transaction_type: newType || null,
      amount: newAmount ? Number(newAmount) : null,
      sector: newSector || null,
    }).select().single();
    if (!error && data) {
      setTransactions((prev) => [data, ...prev]);
      setNewCompany(""); setNewType(""); setNewAmount(""); setNewSector("");
      setShowNew(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("transactions").delete().in("id", Array.from(selected));
    if (!error) { setTransactions((prev) => prev.filter((t) => !selected.has(t.id))); setSelected(new Set()); }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const dbValue = bulkField === "amount" || bulkField === "annual_revenue" ? (bulkValue ? Number(bulkValue) : null) : (bulkValue || null);
    const { error } = await supabase.from("transactions").update({ [bulkField]: dbValue }).in("id", ids);
    if (!error) {
      setTransactions((prev) => prev.map((t) => selected.has(t.id) ? { ...t, [bulkField]: dbValue } : t));
      setSelected(new Set()); setShowBulk(false);
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((t) => t.id))); };

  const types = [...new Set(transactions.map((t) => t.transaction_type).filter(Boolean))] as string[];
  const sports = [...new Set(transactions.map((t) => t.sport).filter(Boolean))] as string[];

  const filtered = transactions.filter((t) => {
    if (search) {
      const s = search.toLowerCase();
      if (!t.company?.toLowerCase().includes(s) && !t.sector?.toLowerCase().includes(s) && !t.investors_buyers?.toLowerCase().includes(s)) return false;
    }
    if (filterType && t.transaction_type !== filterType) return false;
    if (filterSport && t.sport !== filterSport) return false;
    return true;
  });

  const totalAmount = filtered.reduce((sum, t) => sum + (t.amount || 0), 0);

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} of {transactions.length} deals · ${(totalAmount / 1000000).toFixed(0)}M total</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Deal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Company *</label><Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Type</label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="">—</option>{TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Amount ($)</label><Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} /></div>
              </div>
              <div><label className="text-xs text-gray-500">Sector</label><Input value={newSector} onChange={(e) => setNewSector(e.target.value)} /></div>
              <Button onClick={createTransaction} className="w-full" disabled={!newCompany.trim()}>Create Transaction</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Bulk Update</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Transactions</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}>
                    <option value="">Select...</option>
                    <option value="transaction_type">Type</option>
                    <option value="sport">Sport</option>
                    <option value="investment_stage">Stage</option>
                  </select>
                </div>
                {bulkField === "transaction_type" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>}
                {bulkField === "sport" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "investment_stage" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search deals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters</Button>
      </div>

      {showFilters && (
        <Card className="mb-4"><CardContent className="pt-4 pb-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Type</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="">All</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Sport</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterSport} onChange={(e) => setFilterSport(e.target.value)}><option value="">All</option>{sports.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterType(""); setFilterSport(""); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
        </div></CardContent></Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="w-10 px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Company</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Sector</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Sport</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Geography</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
            </tr></thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={`border-b hover:bg-gray-50 ${selected.has(t.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3"><button onClick={() => toggleSelect(t.id)}>{selected.has(t.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                  <td className="px-4 py-2"><div className="flex items-center gap-2"><Link href={`/transactions/${t.id}`} className="text-blue-600 hover:underline shrink-0">↗</Link><EditableCell value={t.company} onSave={(v) => updateCell(t.id, "company", v)} /></div></td>
                  <td className="px-4 py-2 text-right"><EditableCell value={t.amount} onSave={(v) => updateCell(t.id, "amount", v)} type="number" /></td>
                  <td className="px-4 py-2"><EditableCell value={t.transaction_type} onSave={(v) => updateCell(t.id, "transaction_type", v)} type="select" options={TRANSACTION_TYPES} /></td>
                  <td className="px-4 py-2"><EditableCell value={t.sector} onSave={(v) => updateCell(t.id, "sector", v)} /></td>
                  <td className="px-4 py-2"><EditableCell value={t.sport} onSave={(v) => updateCell(t.id, "sport", v)} type="select" options={SPORTS} /></td>
                  <td className="px-4 py-2"><EditableCell value={t.investment_date} onSave={(v) => updateCell(t.id, "investment_date", v)} type="date" /></td>
                  <td className="px-4 py-2"><EditableCell value={t.geography} onSave={(v) => updateCell(t.id, "geography", v)} /></td>
                  <td className="px-4 py-2"><EditableCell value={t.investment_stage} onSave={(v) => updateCell(t.id, "investment_stage", v)} type="select" options={STAGES} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
