"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import Link from "next/link";

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
}

interface LinkedItem {
  id: string;
  label: string;
  sub?: string;
  href: string;
  role?: string | null;
  linkId: string; // the FK value used for deletion
}

interface EntityLinkerProps {
  title: string;
  icon: React.ReactNode;
  items: LinkedItem[];
  onLink: (entityId: string, role?: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
  onSearch: (query: string) => Promise<SearchResult[]>;
  existingIds: Set<string>;
}

export function EntityLinker({ title, icon, items, onLink, onUnlink, onSearch, existingIds }: EntityLinkerProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (showSearch && inputRef.current) inputRef.current.focus();
  }, [showSearch]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    setSearching(true);
    const res = await onSearch(q);
    // Filter out already-linked items
    setResults(res.filter((r) => !existingIds.has(r.id)));
    setSearching(false);
  }, [onSearch, existingIds]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = async (item: SearchResult) => {
    setLinking(true);
    await onLink(item.id);
    setQuery("");
    setResults([]);
    setShowSearch(false);
    setLinking(false);
  };

  const handleUnlink = async (linkId: string) => {
    await onUnlink(linkId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          {icon} {title}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setShowSearch(!showSearch); setQuery(""); setResults([]); }}
          className="text-xs"
        >
          {showSearch ? <X className="h-3.5 w-3.5" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Link</>}
        </Button>
      </div>

      {showSearch && (
        <div className="mb-3 relative">
          <Input
            ref={inputRef}
            placeholder="Search to link..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="text-sm"
          />
          {(results.length > 0 || searching) && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searching && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
              {results.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0 disabled:opacity-50"
                  onClick={() => handleSelect(r)}
                  disabled={linking}
                >
                  <span className="font-medium">{r.label}</span>
                  {r.sub && <span className="text-gray-400 ml-1 text-xs">({r.sub})</span>}
                </button>
              ))}
              {!searching && query.length > 0 && results.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No results found</div>
              )}
            </div>
          )}
        </div>
      )}

      {items.length === 0 && !showSearch ? (
        <p className="text-sm text-gray-400">None</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.linkId} className="flex items-center justify-between py-1 group">
              <Link href={item.href} className="text-sm text-blue-600 hover:underline truncate">
                {item.label}
                {item.sub && <span className="text-gray-400 ml-1">({item.sub})</span>}
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {item.role && <Badge variant="outline" className="text-xs">{item.role}</Badge>}
                <button
                  onClick={() => handleUnlink(item.linkId)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Unlink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
