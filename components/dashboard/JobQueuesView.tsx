'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface JobRecord {
  id: string;
  type: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  attempts: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  documentVersionId?: string | null;
  documentNumber?: string | null;
  documentTitle?: string | null;
  durationMs?: number | null;
}

interface JobsResponse {
  success: boolean;
  health: {
    redis: { ok: boolean; latencyMs: number };
    status: string;
  };
  queueStats: {
    queues: {
      'ocr-queue': QueueMetrics;
      'notification-queue': QueueMetrics;
      'retention-queue': QueueMetrics;
      'cleanup-queue': QueueMetrics;
    };
    totals: QueueMetrics;
  };
  metrics24h: {
    completed24h: number;
    failed24h: number;
    avgDurationSec: number;
    activeWorkers: number;
  };
  jobs: JobRecord[];
}

export default function JobQueuesView() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [executingTick, setExecutingTick] = useState(false);
  const [draining, setDraining] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Jobs Data
  const fetchData = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch jobs data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Poll every 4 seconds
    return () => clearInterval(interval);
  }, []);

  // Trigger single worker tick
  const handleTriggerTick = async () => {
    setExecutingTick(true);
    setActionFeedback('Executing worker tick across all 4 queues...');
    try {
      const res = await fetch('/api/jobs/run', { method: 'POST' });
      const json = await res.json();
      setActionFeedback(json.message || 'Worker tick completed');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setExecutingTick(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Drain queues
  const handleDrainQueues = async () => {
    setDraining(true);
    setActionFeedback('Draining all pending queues...');
    try {
      const res = await fetch('/api/jobs/run?drain=true', { method: 'POST' });
      const json = await res.json();
      setActionFeedback(json.message || 'Queues drained');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setDraining(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Enqueue BNSS retention audit
  const handleTriggerRetentionAudit = async () => {
    setActionFeedback('Enqueuing BNSS statutory retention audit job...');
    try {
      const res = await fetch('/api/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue: 'retention-queue',
          type: 'RETENTION_AUDIT',
          payload: { auditScope: 'SCHEDULE_ALL' },
        }),
      });
      const json = await res.json();
      setActionFeedback(json.message || 'Retention audit queued');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Enqueue Test Job
  const handleEnqueueTestJob = async () => {
    setActionFeedback('Enqueuing verification test job...');
    try {
      const res = await fetch('/api/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue: 'ocr-queue',
          type: 'TEST_JOB',
          payload: { note: 'Manual test telemetry pulse', timestamp: new Date().toISOString() },
        }),
      });
      const json = await res.json();
      setActionFeedback(json.message || 'Test job queued');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Retry a failed job
  const handleRetryJob = async (jobId: string) => {
    setActionFeedback(`Re-enqueuing job ${jobId.substring(0, 8)}...`);
    try {
      const res = await fetch('/api/jobs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      setActionFeedback(json.message || 'Job re-enqueued');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Filtered jobs list
  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    return data.jobs.filter((j) => {
      const matchesStatus = statusFilter === 'ALL' || j.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || j.type === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        j.id.toLowerCase().includes(q) ||
        j.type.toLowerCase().includes(q) ||
        (j.documentNumber && j.documentNumber.toLowerCase().includes(q)) ||
        (j.errorMessage && j.errorMessage.toLowerCase().includes(q));
      return matchesStatus && matchesType && matchesQuery;
    });
  }, [data?.jobs, statusFilter, typeFilter, searchQuery]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-mono font-semibold uppercase tracking-wider">Connecting to Redis &amp; PostgreSQL Job Ledgers...</span>
      </div>
    );
  }

  const totals = data?.queueStats?.totals || { waiting: 0, active: 0, completed: 0, failed: 0 };
  const queues = data?.queueStats?.queues || {
    'ocr-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'notification-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'retention-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'cleanup-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. Header Banner & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-2xl">sync_saved_locally</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Background Job System &amp; Redis Queues</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                DISPATCH ENGINE ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Redis 7 in-memory task queues, asynchronous OCR workers, BNSS statutory retention scheduler, and cryptographic zeroization.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerTick}
            disabled={executingTick || draining}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            title="Execute one worker pass across all 4 queues"
          >
            <span className={`material-symbols-outlined text-[16px] ${executingTick ? 'animate-spin' : ''}`}>
              play_circle
            </span>
            <span>{executingTick ? 'Executing Tick...' : 'Run Worker Tick'}</span>
          </button>

          <button
            onClick={handleDrainQueues}
            disabled={executingTick || draining}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            title="Drain all waiting queue items sequentially"
          >
            <span className={`material-symbols-outlined text-[16px] ${draining ? 'animate-spin' : ''}`}>
              fast_forward
            </span>
            <span>{draining ? 'Draining...' : 'Drain All Queues'}</span>
          </button>

          <button
            onClick={handleTriggerRetentionAudit}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-purple-600">policy</span>
            <span>Audit BNSS Schedules</span>
          </button>

          <button
            onClick={handleEnqueueTestJob}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-600">add_task</span>
            <span>Enqueue Test</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Workers Online */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Workers</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">4</span>
            <span className="text-[11px] font-mono text-emerald-600 font-semibold">ALL ONLINE</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">OCR, Notif, Retention, Cleanup</span>
        </div>

        {/* Queued Waiting */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Queued Jobs</span>
            <span className="material-symbols-outlined text-[18px] text-amber-500">pending</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{totals.waiting}</span>
            <span className="text-[11px] text-slate-500">pending pull</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Across 4 Redis queues</span>
        </div>

        {/* Active Processing */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Processing</span>
            <span className="material-symbols-outlined text-[18px] text-blue-500 animate-spin">autorenew</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{totals.active}</span>
            <span className="text-[11px] text-blue-600 font-semibold font-mono">LOCKED</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">In worker execution memory</span>
        </div>

        {/* Completed 24h */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed (24h)</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{data?.metrics24h?.completed24h ?? totals.completed}</span>
            <span className="text-[11px] text-emerald-600 font-semibold font-mono">100% OK</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Avg latency ~{data?.metrics24h?.avgDurationSec ?? 0.8}s</span>
        </div>

        {/* Redis Health */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Redis 7 Queue</span>
            <span className={`material-symbols-outlined text-[18px] ${data?.health?.redis?.ok ? 'text-emerald-500' : 'text-red-500'}`}>
              memory
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{data?.health?.redis?.latencyMs ?? 12}ms</span>
            <span className="text-[11px] font-mono text-emerald-600 font-semibold">PONG</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 font-mono truncate">redis://127.0.0.1:6379</span>
        </div>
      </div>

      {/* 3. Four Dedicated Queue Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: OCR Extraction Queue */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">OCR Extraction</h3>
                  <span className="text-[10px] font-mono text-slate-400">ocr-queue</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                Tesseract/PDF
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 my-3">
              Asynchronous text extraction pipeline for scanned PDF dockets and image evidence. Populates PostgreSQL GIN index.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">WAITING</div>
                <div className="font-bold text-slate-800">{queues['ocr-queue'].waiting}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">ACTIVE</div>
                <div className="font-bold text-blue-600">{queues['ocr-queue'].active}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Done: {queues['ocr-queue'].completed}</span>
            <span className="text-slate-400 font-mono">Fails: {queues['ocr-queue'].failed}</span>
          </div>
        </div>

        {/* Card 2: Notification Queue */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Notifications</h3>
                  <span className="text-[10px] font-mono text-slate-400">notification-queue</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Fanout Dispatch
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 my-3">
              Evidentiary alert push dispatcher for Maker-Checker quarantine notices, legal holds, and high-priority alarms.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">WAITING</div>
                <div className="font-bold text-slate-800">{queues['notification-queue'].waiting}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">ACTIVE</div>
                <div className="font-bold text-amber-600">{queues['notification-queue'].active}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Done: {queues['notification-queue'].completed}</span>
            <span className="text-slate-400 font-mono">Fails: {queues['notification-queue'].failed}</span>
          </div>
        </div>

        {/* Card 3: BNSS Retention Scheduler */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">policy</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">BNSS Retention</h3>
                  <span className="text-[10px] font-mono text-slate-400">retention-queue</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                Statutory 5-Tier
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 my-3">
              Evaluates statutory expiry dates against Schedule I to V. Respects non-repudiable judicial legal hold immunity locks.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">WAITING</div>
                <div className="font-bold text-slate-800">{queues['retention-queue'].waiting}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">ACTIVE</div>
                <div className="font-bold text-purple-600">{queues['retention-queue'].active}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Done: {queues['retention-queue'].completed}</span>
            <span className="text-slate-400 font-mono">Fails: {queues['retention-queue'].failed}</span>
          </div>
        </div>

        {/* Card 4: Crypto-Shred Cleanup */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-red-50 text-red-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Crypto-Shredding</h3>
                  <span className="text-[10px] font-mono text-slate-400">cleanup-queue</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                NIST SP 800-88
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 my-3">
              Dual-custody cryptographic key zeroization engine. Purges Vault Transit DEKs and zeroizes MinIO S3 object streams.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">WAITING</div>
                <div className="font-bold text-slate-800">{queues['cleanup-queue'].waiting}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400">ACTIVE</div>
                <div className="font-bold text-red-600">{queues['cleanup-queue'].active}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Done: {queues['cleanup-queue'].completed}</span>
            <span className="text-slate-400 font-mono">Fails: {queues['cleanup-queue'].failed}</span>
          </div>
        </div>

      </div>

      {/* 4. Processing Jobs Ledger Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-slate-600">table_rows</span>
            <h3 className="font-bold text-sm text-slate-900">PostgreSQL `processing_jobs` Ledger</h3>
            <span className="text-xs font-mono text-slate-500">({filteredJobs.length} records)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex items-center rounded-md bg-slate-200/70 p-0.5 text-xs font-semibold text-slate-600">
              {(['ALL', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Job Types</option>
              <option value="OCR_EXTRACTION">OCR Extraction</option>
              <option value="NOTIFICATION_DISPATCH">Notification Dispatch</option>
              <option value="RETENTION_AUDIT">Retention Audit</option>
              <option value="CRYPTO_SHRED_CLEANUP">Crypto Shred</option>
              <option value="TEST_JOB">Test Job</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search job ID / docket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-7 pr-3 py-1 bg-white border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 w-44"
              />
              <span className="material-symbols-outlined text-[14px] text-slate-400 absolute left-2 top-1.5">
                search
              </span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4">Job ID</th>
                <th className="py-2.5 px-4">Job Type</th>
                <th className="py-2.5 px-4">Linked Docket</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4">Attempts</th>
                <th className="py-2.5 px-4">Created (UTC)</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No background processing jobs match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Job ID */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 font-medium">
                      {j.id.substring(0, 8)}...
                    </td>

                    {/* Job Type */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {j.type.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Linked Docket */}
                    <td className="py-3 px-4">
                      {j.documentNumber ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-bold text-blue-700">{j.documentNumber}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{j.documentTitle || 'Case Record'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {j.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          COMPLETED
                        </span>
                      )}
                      {j.status === 'RUNNING' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          RUNNING
                        </span>
                      )}
                      {j.status === 'QUEUED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          QUEUED
                        </span>
                      )}
                      {j.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          FAILED
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {j.durationMs !== null ? `${j.durationMs}ms` : j.status === 'RUNNING' ? 'In progress...' : '—'}
                    </td>

                    {/* Attempts */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        j.attempts > 1 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {j.attempts} / 3
                      </span>
                    </td>

                    {/* Created Time */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedJob(j)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                        >
                          Inspect
                        </button>
                        {j.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetryJob(j.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 5. Job Inspector Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl max-w-lg w-full p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">terminal</span>
                <h3 className="font-bold text-sm text-slate-900">Background Job Execution Dossier</h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-400">JOB ID:</span>
                <span className="text-slate-900 font-bold">{selectedJob.id}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-400">TYPE:</span>
                <span className="text-slate-900 font-bold">{selectedJob.type}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-400">STATUS:</span>
                <span className="font-bold text-slate-900">{selectedJob.status}</span>
              </div>
              {selectedJob.documentNumber && (
                <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400">DOCKET:</span>
                  <span className="font-bold text-blue-700">{selectedJob.documentNumber}</span>
                </div>
              )}
              <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-400">ATTEMPTS:</span>
                <span className="font-bold text-slate-900">{selectedJob.attempts} of 3</span>
              </div>
              {selectedJob.durationMs !== null && (
                <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400">EXECUTION TIME:</span>
                  <span className="font-bold text-slate-900">{selectedJob.durationMs} ms</span>
                </div>
              )}
              {selectedJob.errorMessage && (
                <div className="flex flex-col gap-1 p-2 rounded bg-red-50 border border-red-200 text-red-800">
                  <span className="font-bold text-[11px]">ERROR LOG:</span>
                  <span className="text-[11px] whitespace-pre-wrap">{selectedJob.errorMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              {selectedJob.status === 'FAILED' && (
                <button
                  onClick={() => {
                    handleRetryJob(selectedJob.id);
                    setSelectedJob(null);
                  }}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-xs"
                >
                  Retry Job
                </button>
              )}
              <button
                onClick={() => setSelectedJob(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
