"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Brain,
  Upload,
  FileText,
  File,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Tag,
  Building2,
  Clock,
  Search,
  RefreshCw,
  Trash2,
  MessageSquare,
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
} from "lucide-react";

/* ── Supabase client ── */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/* ── Types ── */

interface KnowledgeEntry {
  id: string;
  title: string;
  source_type: string;
  source_ref: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  summary: string | null;
  taxonomy_categories: string[] | null;
  entity_ids: string[] | null;
  tags: string[] | null;
  uploaded_by: string | null;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  content_text: string | null;
  created_at: string;
  metadata: {
    sentiment?: "positive" | "negative" | "neutral" | "mixed";
    sentiment_score?: number;
    relevance_to_mim?: "high" | "medium" | "low";
    relevance_reasoning?: string;
    rss_source?: string;
    published_date?: string;
    key_entities?: string[];
  } | null;
}

/* ── Helper: format bytes ── */

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Helper: source type badge ── */

function sourceBadge(type: string) {
  const colors: Record<string, string> = {
    upload: "bg-blue-100 text-blue-700",
    email: "bg-purple-100 text-purple-700",
    slack: "bg-green-100 text-green-700",
    api: "bg-gray-100 text-gray-700",
    chat: "bg-amber-100 text-amber-700",
    notion: "bg-red-100 text-red-700",
    news: "bg-orange-100 text-orange-700",
  };
  return colors[type] || "bg-gray-100 text-gray-700";
}

/* ── Helper: sentiment badge ── */

function sentimentBadge(sentiment: string | undefined) {
  if (!sentiment) return null;
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    positive: { color: "bg-green-50 text-green-700 border-green-200", icon: <TrendingUp className="h-3 w-3" /> },
    negative: { color: "bg-red-50 text-red-700 border-red-200", icon: <TrendingDown className="h-3 w-3" /> },
    neutral: { color: "bg-gray-50 text-gray-600 border-gray-200", icon: <Minus className="h-3 w-3" /> },
    mixed: { color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: <TrendingUp className="h-3 w-3" /> },
  };
  const c = config[sentiment] || config.neutral;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${c.color}`}>
      {c.icon}
      {sentiment}
    </span>
  );
}

/* ── Helper: relevance badge ── */

function relevanceBadge(relevance: string | undefined) {
  if (!relevance) return null;
  const config: Record<string, string> = {
    high: "bg-purple-50 text-purple-700 border-purple-200 font-medium",
    medium: "bg-blue-50 text-blue-600 border-blue-200",
    low: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border ${config[relevance] || config.low}`}>
      {relevance === "high" ? "⚡ " : ""}{relevance} relevance
    </span>
  );
}

/* ── Helper: file type icon ── */

function fileTypeIcon(type: string | null, sourceType?: string) {
  if (sourceType === "news") return <Newspaper className="h-4 w-4 text-orange-500" />;
  if (!type) return <MessageSquare className="h-4 w-4 text-gray-400" />;
  if (type === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (type === "docx") return <FileText className="h-4 w-4 text-blue-500" />;
  if (type === "pptx") return <FileText className="h-4 w-4 text-orange-500" />;
  return <File className="h-4 w-4 text-gray-500" />;
}

/* ── Main Page ── */

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text paste state
  const [showTextInput, setShowTextInput] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  /* ── Fetch entries ── */

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from("knowledge_base")
        .select("id, title, source_type, source_ref, file_type, file_size_bytes, summary, taxonomy_categories, entity_ids, tags, uploaded_by, processed, processed_at, error, content_text, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterSource !== "all") {
        query = query.eq("source_type", filterSource);
      }

      const { data } = await query;
      setEntries(data || []);
    } catch {
      // Table may not exist yet
      setEntries([]);
    }
    setLoading(false);
  }, [filterSource]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /* ── File upload handler ── */

  const handleFileUpload = async (file: File) => {
    // Vercel Hobby plan has a ~4.5MB body size limit for serverless functions
    const MAX_UPLOAD_SIZE = 4.5 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadResult({
        success: false,
        message: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum upload size is ~4.5MB on Vercel Hobby plan.`,
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_type", "upload");
      formData.append("uploaded_by", "web");

      const res = await fetch("/api/brain/ingest", {
        method: "POST",
        body: formData,
      });

      // Handle non-JSON responses (e.g. Vercel 413 "Request Entity Too Large")
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        setUploadResult({
          success: false,
          message: `Server error (${res.status}): ${text.slice(0, 200) || res.statusText}`,
        });
        setUploading(false);
        return;
      }

      const data = await res.json();

      if (data.success) {
        setUploadResult({
          success: true,
          message: `"${data.title}" ingested — ${data.chunks} chunks, ${data.categories?.length || 0} categories, ${data.tags?.length || 0} tags`,
        });
        fetchEntries();
      } else {
        setUploadResult({ success: false, message: data.error || "Upload failed" });
      }
    } catch (err) {
      setUploadResult({ success: false, message: String(err) });
    }

    setUploading(false);
  };

  /* ── Text paste handler ── */

  const handleTextSubmit = async () => {
    if (!pasteText.trim()) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const res = await fetch("/api/brain/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pasteTitle || pasteText.slice(0, 80),
          text: pasteText,
          source_type: "upload",
          uploaded_by: "web",
        }),
      });

      // Handle non-JSON responses
      const resContentType = res.headers.get("content-type") || "";
      if (!resContentType.includes("application/json")) {
        const text = await res.text();
        setUploadResult({
          success: false,
          message: `Server error (${res.status}): ${text.slice(0, 200) || res.statusText}`,
        });
        setUploading(false);
        return;
      }

      const data = await res.json();

      if (data.success) {
        setUploadResult({
          success: true,
          message: `"${data.title}" ingested — ${data.chunks} chunks`,
        });
        setPasteTitle("");
        setPasteText("");
        setShowTextInput(false);
        fetchEntries();
      } else {
        setUploadResult({ success: false, message: data.error || "Ingestion failed" });
      }
    } catch (err) {
      setUploadResult({ success: false, message: String(err) });
    }

    setUploading(false);
  };

  /* ── Delete handler ── */

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this knowledge entry? This cannot be undone.")) return;
    await getSupabase().from("knowledge_base").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  /* ── Drag-and-drop handlers ── */

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  /* ── Filtered entries ── */

  const filtered = entries.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      (e.summary || "").toLowerCase().includes(q) ||
      (e.tags || []).some((t) => t.includes(q)) ||
      (e.taxonomy_categories || []).some((c) => c.includes(q))
    );
  });

  /* ── Stats ── */

  const totalDocs = entries.length;
  const processedDocs = entries.filter((e) => e.processed).length;
  const sources = new Set(entries.map((e) => e.source_type));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
            <p className="text-sm text-gray-500">
              Feed the brain — upload documents, paste research, or ingest from any surface area
            </p>
          </div>
        </div>
        <button
          onClick={fetchEntries}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Documents</p>
          <p className="text-2xl font-bold text-gray-900">{totalDocs}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Processed</p>
          <p className="text-2xl font-bold text-green-600">{processedDocs}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Sources</p>
          <p className="text-2xl font-bold text-purple-600">{sources.size}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Text</p>
          <p className="text-2xl font-bold text-blue-600">
            {Math.round(entries.reduce((acc, e) => acc + (e.content_text?.length || 0), 0) / 4).toLocaleString()}{" "}
            <span className="text-sm font-normal text-gray-500">tokens</span>
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Ingest Knowledge</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowTextInput(false); fileInputRef.current?.click(); }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </button>
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showTextInput
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Paste Text
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.txt,.md,.html,.csv,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />

        {/* Text paste area */}
        {showTextInput && (
          <div className="mb-4 space-y-3">
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste meeting notes, research excerpts, competitive analysis, or any text content..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
            />
            <div className="flex justify-end">
              <button
                onClick={handleTextSubmit}
                disabled={!pasteText.trim() || uploading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Ingest Text
              </button>
            </div>
          </div>
        )}

        {/* Drag & drop zone */}
        {!showTextInput && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-purple-500 bg-purple-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                <p className="text-sm text-gray-600">Processing document...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Drag & drop a file here, or click{" "}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-purple-600 underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-gray-400">
                  Supports PDF, DOCX, PPTX, TXT, MD, HTML, CSV, JSON (max 50MB)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Upload result banner */}
        {uploadResult && (
          <div
            className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
              uploadResult.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {uploadResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{uploadResult.message}</span>
            <button onClick={() => setUploadResult(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Surface area hints */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-gray-400">Other ingestion surfaces:</span>
          <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
            📧 brain@mim.co
          </span>
          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
            💬 #brain Slack channel
          </span>
          <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
            🔗 POST /api/brain/ingest
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Sources</option>
          <option value="upload">Uploads</option>
          <option value="news">News</option>
          <option value="email">Email</option>
          <option value="slack">Slack</option>
          <option value="api">API</option>
          <option value="chat">Chat</option>
        </select>
      </div>

      {/* Knowledge table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Loading knowledge base...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Brain className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No knowledge ingested yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Upload a document, paste text, or send content to the brain endpoint
            </p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_120px_140px_60px] gap-4 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Title</span>
              <span>Source</span>
              <span>Type</span>
              <span>Categories</span>
              <span>Date</span>
              <span></span>
            </div>

            {/* Rows */}
            {filtered.map((entry) => (
              <div key={entry.id} className="border-b border-gray-100 last:border-b-0">
                {/* Main row */}
                <div
                  className="grid grid-cols-[1fr_100px_100px_120px_140px_60px] gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer items-center"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandedId === entry.id ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                    {fileTypeIcon(entry.file_type, entry.source_type)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {entry.title}
                        </p>
                        {entry.source_type === "news" && entry.metadata?.sentiment && (
                          <div className="flex items-center gap-1 shrink-0">
                            {sentimentBadge(entry.metadata.sentiment)}
                            {relevanceBadge(entry.metadata.relevance_to_mim)}
                          </div>
                        )}
                      </div>
                      {entry.summary && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {entry.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${sourceBadge(entry.source_type)}`}>
                    {entry.source_type}
                  </span>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">{entry.file_type || "text"}</span>
                    {entry.file_size_bytes && (
                      <span className="text-xs text-gray-400">
                        ({formatBytes(entry.file_size_bytes)})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(entry.taxonomy_categories || []).slice(0, 2).map((c) => (
                      <span
                        key={c}
                        className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded"
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.created_at).toLocaleDateString()}
                    {!entry.processed && (
                      <Loader2 className="h-3 w-3 animate-spin text-amber-500 ml-1" />
                    )}
                    {entry.error && (
                      <AlertTriangle className="h-3 w-3 text-red-500 ml-1" />
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded detail */}
                {expandedId === entry.id && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-6 pt-4">
                      {/* Left: Summary + Tags + Sentiment */}
                      <div className="space-y-4">
                        {entry.summary && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Summary</h4>
                            <p className="text-sm text-gray-700">{entry.summary}</p>
                          </div>
                        )}

                        {/* News-specific: Sentiment & Relevance detail */}
                        {entry.source_type === "news" && entry.metadata && (
                          <div className="space-y-3">
                            {entry.metadata.sentiment && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Sentiment Analysis</h4>
                                <div className="flex items-center gap-3">
                                  {sentimentBadge(entry.metadata.sentiment)}
                                  {entry.metadata.sentiment_score !== undefined && (
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            entry.metadata.sentiment_score > 0.6
                                              ? "bg-green-500"
                                              : entry.metadata.sentiment_score < 0.4
                                                ? "bg-red-500"
                                                : "bg-yellow-500"
                                          }`}
                                          style={{ width: `${entry.metadata.sentiment_score * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        {(entry.metadata.sentiment_score * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {entry.metadata.relevance_to_mim && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">MiM Relevance</h4>
                                <div className="flex items-center gap-2">
                                  {relevanceBadge(entry.metadata.relevance_to_mim)}
                                </div>
                                {entry.metadata.relevance_reasoning && (
                                  <p className="text-xs text-gray-600 mt-1 italic">
                                    {entry.metadata.relevance_reasoning}
                                  </p>
                                )}
                              </div>
                            )}

                            {entry.metadata.rss_source && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Newspaper className="h-3 w-3" />
                                <span>{entry.metadata.rss_source}</span>
                                {entry.metadata.published_date && (
                                  <span>· {new Date(entry.metadata.published_date).toLocaleDateString()}</span>
                                )}
                                {entry.source_ref && (
                                  <a
                                    href={entry.source_ref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Original
                                  </a>
                                )}
                              </div>
                            )}

                            {entry.metadata.key_entities && entry.metadata.key_entities.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Key Entities Mentioned</h4>
                                <div className="flex flex-wrap gap-1">
                                  {entry.metadata.key_entities.map((entity) => (
                                    <span
                                      key={entity}
                                      className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100"
                                    >
                                      {entity}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {entry.tags && entry.tags.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                              <Tag className="h-3 w-3" /> Tags
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {entry.entity_ids && entry.entity_ids.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Linked Entities
                            </h4>
                            <p className="text-xs text-gray-500">
                              {entry.entity_ids.length} entity(ies) linked
                            </p>
                          </div>
                        )}

                        {entry.error && (
                          <div>
                            <h4 className="text-xs font-medium text-red-500 uppercase mb-1">Error</h4>
                            <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded">
                              {entry.error}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right: Content preview */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                          Content Preview
                        </h4>
                        <div className="text-xs text-gray-600 font-mono bg-white border border-gray-200 rounded p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {entry.content_text
                            ? entry.content_text.slice(0, 2000) +
                              (entry.content_text.length > 2000 ? "\n\n... [truncated]" : "")
                            : "No text content available"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
