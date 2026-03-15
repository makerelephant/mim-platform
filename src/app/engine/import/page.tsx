"use client";

import { useState, useCallback, useRef } from "react";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

interface BatchResult {
  messagesFound: number;
  processed: number;
  tasksCreated: number;
  skippedDupes: number;
  contactsCreated: number;
  preFiltered: number;
  threadSkipped: number;
}

interface ImportResponse {
  success: boolean;
  done: boolean;
  cursor: number;
  totalHours: number;
  batchScanHours?: number;
  batch?: BatchResult;
  logTail?: string[];
  error?: string;
  message?: string;
}

interface CumulativeStats {
  totalProcessed: number;
  totalTasks: number;
  totalSkipped: number;
  totalContacts: number;
  totalPreFiltered: number;
  batchesCompleted: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BulkImportPage() {
  const [days, setDays] = useState(30);
  const [chunkHours, setChunkHours] = useState(8);
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CumulativeStats>({
    totalProcessed: 0,
    totalTasks: 0,
    totalSkipped: 0,
    totalContacts: 0,
    totalPreFiltered: 0,
    batchesCompleted: 0,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 200));
  }, []);

  const startImport = useCallback(async () => {
    setRunning(true);
    setDone(false);
    setError(null);
    setCursor(0);
    setTotalHours(days * 24);
    setStats({
      totalProcessed: 0,
      totalTasks: 0,
      totalSkipped: 0,
      totalContacts: 0,
      totalPreFiltered: 0,
      batchesCompleted: 0,
    });
    setLogs([]);
    abortRef.current = false;

    let currentCursor = 0;
    const total = days * 24;

    addLog(`Starting bulk import: ${days} days (${total} hours) in ${chunkHours}-hour chunks`);

    while (currentCursor < total && !abortRef.current) {
      const batchNum = Math.floor(currentCursor / chunkHours) + 1;
      const totalBatches = Math.ceil(total / chunkHours);
      addLog(`Batch ${batchNum}/${totalBatches} — scanning up to ${currentCursor + chunkHours}h ago...`);

      try {
        const res = await fetch("/api/agents/gmail-bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days, chunkHours, cursor: currentCursor }),
        });

        const data: ImportResponse = await res.json();

        if (!data.success) {
          setError(data.error || "Unknown error");
          addLog(`ERROR: ${data.error}`);
          break;
        }

        if (data.batch) {
          setStats((prev) => ({
            totalProcessed: prev.totalProcessed + data.batch!.processed,
            totalTasks: prev.totalTasks + data.batch!.tasksCreated,
            totalSkipped: prev.totalSkipped + data.batch!.skippedDupes,
            totalContacts: prev.totalContacts + data.batch!.contactsCreated,
            totalPreFiltered: prev.totalPreFiltered + data.batch!.preFiltered,
            batchesCompleted: prev.batchesCompleted + 1,
          }));
          addLog(
            `Batch done: ${data.batch.processed} processed, ${data.batch.skippedDupes} dupes skipped, ${data.batch.tasksCreated} tasks`
          );
        }

        if (data.logTail) {
          for (const line of data.logTail) {
            addLog(`  > ${line}`);
          }
        }

        currentCursor = data.cursor;
        setCursor(currentCursor);

        if (data.done) {
          setDone(true);
          addLog("Import complete!");
          break;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        setError(errMsg);
        addLog(`FETCH ERROR: ${errMsg}`);
        break;
      }
    }

    if (abortRef.current) {
      addLog("Import stopped by user.");
    }

    setRunning(false);
  }, [days, chunkHours, addLog]);

  const stopImport = useCallback(() => {
    abortRef.current = true;
    addLog("Stopping after current batch...");
  }, [addLog]);

  const progressPct = totalHours > 0 ? Math.round((cursor / totalHours) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bulk Gmail Import</h1>
          <p className="text-sm text-white/50 mt-1">
            Import historical emails in batches to avoid Vercel timeouts.
            Each batch processes one time-window and relies on deduplication to skip already-seen messages.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex gap-6">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/40 uppercase tracking-wider">Days to import</span>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 30)}
                disabled={running}
                className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 disabled:opacity-40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/40 uppercase tracking-wider">Chunk size (hours)</span>
              <input
                type="number"
                min={1}
                max={48}
                value={chunkHours}
                onChange={(e) => setChunkHours(Number(e.target.value) || 8)}
                disabled={running}
                className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 disabled:opacity-40"
              />
            </label>
          </div>

          <div className="flex gap-3">
            {!running ? (
              <button
                onClick={startImport}
                className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Start Import
              </button>
            ) : (
              <button
                onClick={stopImport}
                className="px-5 py-2 bg-red-500/80 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
              >
                Stop After Current Batch
              </button>
            )}
          </div>

          {/* Info */}
          <p className="text-xs text-white/30">
            Total: {days * 24} hours / {Math.ceil((days * 24) / chunkHours)} batches.
            Each batch may take 1-3 minutes depending on email volume.
          </p>
        </div>

        {/* Progress */}
        {(running || done || error) && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white/70">Progress</h2>
              <span className="text-sm text-white/50">
                {done ? "Complete" : running ? `${progressPct}%` : error ? "Error" : ""}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  error ? "bg-red-500" : done ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              <StatBox label="Emails Processed" value={stats.totalProcessed} />
              <StatBox label="Tasks Created" value={stats.totalTasks} />
              <StatBox label="Dupes Skipped" value={stats.totalSkipped} />
              <StatBox label="Contacts Created" value={stats.totalContacts} />
              <StatBox label="Pre-filtered" value={stats.totalPreFiltered} />
              <StatBox label="Batches Done" value={stats.batchesCompleted} />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Log */}
        {logs.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-sm font-medium text-white/70 mb-3">Log</h2>
            <div className="max-h-64 overflow-y-auto font-mono text-xs text-white/40 space-y-0.5">
              {logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  );
}
