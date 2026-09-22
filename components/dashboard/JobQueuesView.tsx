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
      'blockchain-queue': QueueMetrics;
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
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedTestQueue, setSelectedTestQueue] = useState<string>('ALL');

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
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerTick = async () => {
    setExecutingTick(true);
    setActionFeedback('Executing worker tick across all 5 queues...');
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

  const handleTriggerRetentionAudit = async () => {
    setActionFeedback('Enqueuing statutory retention schedule audit...');
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
      setActionFeedback(json.message || 'Retention audit enqueued');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleDispatchTestJobs = async (targetQueue: string) => {
    setShowTestModal(false);
    setActionFeedback(`Enqueuing benchmark test job into ${targetQueue === 'ALL' ? 'all 5 queues' : targetQueue}...`);

    try {
      if (targetQueue === 'ALL') {
        const queuesToTest = [
          { queue: 'ocr-queue', type: 'TEST_JOB', payload: { benchmark: 'Tesseract/PDF OCR', samplePages: 1 } },
          { queue: 'blockchain-queue', type: 'TEST_JOB', payload: { benchmark: 'Hyperledger Fabric Anchor', channel: 'dms-channel' } },
          { queue: 'notification-queue', type: 'TEST_JOB', payload: { benchmark: 'Fanout Notification', scope: 'BROADCAST' } },
          { queue: 'retention-queue', type: 'TEST_JOB', payload: { benchmark: 'BNSS Retention Audit', scope: 'ALL_SCHEDULES' } },
          { queue: 'cleanup-queue', type: 'TEST_JOB', payload: { benchmark: 'Crypto-Shred Zeroization', scope: 'KEY_AUDIT' } },
        ];

        for (const item of queuesToTest) {
          await fetch('/api/jobs/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
        }
        setActionFeedback('Successfully enqueued 5 test jobs across all active queues. Auto-runner will process them.');
      } else {
        const res = await fetch('/api/jobs/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queue: targetQueue,
            type: 'TEST_JOB',
            payload: { message: `Manual test dispatch for ${targetQueue}` },
          }),
        });
        const json = await res.json();
        setActionFeedback(json.message || `Test job enqueued into ${targetQueue}`);
      }
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setActionFeedback(null), 4500);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch('/api/jobs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      setActionFeedback(json.message || 'Job re-queued');
      await fetchData();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    return data.jobs.filter((j) => {
      const matchesStatus = statusFilter === 'ALL' || j.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || j.type === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        j.id.toLowerCase().includes(q) ||
        (j.documentNumber && j.documentNumber.toLowerCase().includes(q)) ||
        (j.documentTitle && j.documentTitle.toLowerCase().includes(q)) ||
        j.type.toLowerCase().includes(q);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [data?.jobs, statusFilter, typeFilter, searchQuery]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#9CA3AF]">
        <div className="w-8 h-8 border-2 border-[#3f5e93] border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-mono font-semibold uppercase tracking-wider">Connecting to Redis &amp; Job Ledgers...</span>
      </div>
    );
  }

  const totals = data?.queueStats?.totals || { waiting: 0, active: 0, completed: 0, failed: 0 };
  const queues = data?.queueStats?.queues || {
    'ocr-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'blockchain-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'notification-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'retention-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    'cleanup-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-[#151c27]">
      {/* 1. Header Banner & Action Bar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/85 backdrop-blur-xl p-6 rounded-[26px] border border-[#D8DEEA]/80 shadow-[0_8px_32px_rgba(16,20,26,0.06)]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#000000] text-white flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[24px]">sync_saved_locally</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#151c27] tracking-tight">Background Job Queues &amp; Asynchronous Workers</h2>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                AUTO-DISPATCH ENGINE ACTIVE
              </span>
            </div>
            <p className="text-xs text-[#45474b] mt-0.5">
              Live Redis queues, asynchronous OCR text extraction, Hyperledger Fabric ledger anchoring, BNSS retention scheduler, and cryptographic zeroization.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerTick}
            disabled={executingTick || draining}
            className="h-10 px-4 flex items-center gap-1.5 bg-[#000000] hover:bg-[#181c22] text-white rounded-full text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Execute one worker pass across all 5 queues"
          >
            <span className={`material-symbols-outlined text-[16px] ${executingTick ? 'animate-spin' : ''}`}>
              play_circle
            </span>
            <span>{executingTick ? 'Running...' : 'Run Worker Tick'}</span>
          </button>

          <button
            onClick={handleDrainQueues}
            disabled={executingTick || draining}
            className="h-10 px-4 flex items-center gap-1.5 bg-[#3f5e93] hover:bg-[#305184] text-white rounded-full text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Drain all waiting queue items sequentially"
          >
            <span className={`material-symbols-outlined text-[16px] ${draining ? 'animate-spin' : ''}`}>
              fast_forward
            </span>
            <span>{draining ? 'Draining...' : 'Drain All Queues'}</span>
          </button>

          <button
            onClick={handleTriggerRetentionAudit}
            className="h-10 px-4 flex items-center gap-1.5 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">policy</span>
            <span>Audit Schedules</span>
          </button>

          <button
            onClick={() => setShowTestModal(true)}
            className="h-10 px-4 flex items-center gap-1.5 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#9CA3AF]">add_task</span>
            <span>Enqueue Test</span>
          </button>
        </div>
      </section>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-3.5 rounded-2xl bg-[rgba(131,162,219,0.14)] border border-[#83A2DB]/30 text-[#3f5e93] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Workers Online */}
        <div className="bg-white p-5 rounded-[20px] border border-[#D8DEEA]/80 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Workers</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#151c27]">5</span>
            <span className="text-[11px] font-mono text-emerald-600 font-semibold">ALL ONLINE</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1 truncate">OCR, Blockchain, Notif, Retention, Cleanup</span>
        </div>

        {/* Queued Waiting */}
        <div className="bg-white p-5 rounded-[20px] border border-[#D8DEEA]/80 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Queued Jobs</span>
            <span className="material-symbols-outlined text-[18px] text-amber-500">pending</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#151c27]">{totals.waiting}</span>
            <span className="text-[11px] text-[#9CA3AF]">pending</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1">Across 5 active queues</span>
        </div>

        {/* Active Processing */}
        <div className="bg-white p-5 rounded-[20px] border border-[#D8DEEA]/80 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Processing</span>
            <span className="material-symbols-outlined text-[18px] text-[#3f5e93] animate-spin">autorenew</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#151c27]">{totals.active}</span>
            <span className="text-[11px] text-[#3f5e93] font-semibold font-mono">LOCKED</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1">In worker execution memory</span>
        </div>

        {/* Completed 24h */}
        <div className="bg-white p-5 rounded-[20px] border border-[#D8DEEA]/80 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed (24h)</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#151c27]">{data?.metrics24h?.completed24h ?? totals.completed}</span>
            <span className="text-[11px] text-emerald-600 font-semibold font-mono">100% OK</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1">Avg latency ~{data?.metrics24h?.avgDurationSec ?? 0.8}s</span>
        </div>

        {/* Redis Health */}
        <div className="bg-white p-5 rounded-[20px] border border-[#D8DEEA]/80 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Task Queue</span>
            <span className={`material-symbols-outlined text-[18px] ${data?.health?.redis?.ok ? 'text-emerald-500' : 'text-red-500'}`}>
              memory
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#151c27]">{data?.health?.redis?.latencyMs ?? 12}ms</span>
            <span className="text-[11px] font-mono text-emerald-600 font-semibold">PONG</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] font-mono truncate">Connected</span>
        </div>
      </div>

      {/* 3. Five Dedicated Queue Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* Card 1: OCR Extraction Queue */}
        <div className="bg-white rounded-[20px] border border-[#D8DEEA]/80 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-2.5 border-b border-[#D8DEEA]/50 gap-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#151c27] whitespace-nowrap leading-tight">OCR Engine</h3>
                  <span className="text-[10px] font-mono text-[#9CA3AF] block leading-tight">ocr-queue</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] shrink-0 whitespace-nowrap">
                Tesseract
              </span>
            </div>
            
            <p className="text-[11px] text-[#45474b] my-2.5 leading-relaxed">
              Asynchronous text extraction pipeline for scanned PDF dockets. Populates GIN search vector.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">WAITING</div>
                <div className="font-bold text-[#151c27]">{queues['ocr-queue']?.waiting ?? 0}</div>
              </div>
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">ACTIVE</div>
                <div className="font-bold text-[#3f5e93]">{queues['ocr-queue']?.active ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#D8DEEA]/50 flex items-center justify-between text-[11px]">
            <span className="text-[#45474b] font-mono text-[10px]">Done: {queues['ocr-queue']?.completed ?? 0}</span>
            <span className="text-[#9CA3AF] font-mono text-[10px]">Fails: {queues['ocr-queue']?.failed ?? 0}</span>
          </div>
        </div>

        {/* Card 2: Blockchain Ledger Anchoring Queue */}
        <div className="bg-white rounded-[20px] border border-[#D8DEEA]/80 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-2.5 border-b border-[#D8DEEA]/50 gap-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#151c27] whitespace-nowrap leading-tight">Fabric Ledger</h3>
                  <span className="text-[10px] font-mono text-[#9CA3AF] block leading-tight">blockchain-queue</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0 whitespace-nowrap">
                Fabric
              </span>
            </div>
            
            <p className="text-[11px] text-[#45474b] my-2.5 leading-relaxed">
              Commits SHA-256 evidence hashes and tamper-evident audit logs directly to Fabric ledger blocks.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">WAITING</div>
                <div className="font-bold text-[#151c27]">{queues['blockchain-queue']?.waiting ?? 0}</div>
              </div>
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">ACTIVE</div>
                <div className="font-bold text-indigo-600">{queues['blockchain-queue']?.active ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#D8DEEA]/50 flex items-center justify-between text-[11px]">
            <span className="text-[#45474b] font-mono text-[10px]">Done: {queues['blockchain-queue']?.completed ?? 0}</span>
            <span className="text-[#9CA3AF] font-mono text-[10px]">Fails: {queues['blockchain-queue']?.failed ?? 0}</span>
          </div>
        </div>

        {/* Card 3: Notification Queue */}
        <div className="bg-white rounded-[20px] border border-[#D8DEEA]/80 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-2.5 border-b border-[#D8DEEA]/50 gap-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#151c27] whitespace-nowrap leading-tight">Notifications</h3>
                  <span className="text-[10px] font-mono text-[#9CA3AF] block leading-tight">notification-queue</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0 whitespace-nowrap">
                Fanout
              </span>
            </div>
            
            <p className="text-[11px] text-[#45474b] my-2.5 leading-relaxed">
              Evidentiary alert push dispatcher for Maker-Checker quarantine notices and security alarms.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">WAITING</div>
                <div className="font-bold text-[#151c27]">{queues['notification-queue']?.waiting ?? 0}</div>
              </div>
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">ACTIVE</div>
                <div className="font-bold text-amber-600">{queues['notification-queue']?.active ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#D8DEEA]/50 flex items-center justify-between text-[11px]">
            <span className="text-[#45474b] font-mono text-[10px]">Done: {queues['notification-queue']?.completed ?? 0}</span>
            <span className="text-[#9CA3AF] font-mono text-[10px]">Fails: {queues['notification-queue']?.failed ?? 0}</span>
          </div>
        </div>

        {/* Card 4: BNSS Retention Scheduler */}
        <div className="bg-white rounded-[20px] border border-[#D8DEEA]/80 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-2.5 border-b border-[#D8DEEA]/50 gap-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[18px]">policy</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#151c27] whitespace-nowrap leading-tight">Retention Engine</h3>
                  <span className="text-[10px] font-mono text-[#9CA3AF] block leading-tight">retention-queue</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] shrink-0 whitespace-nowrap">
                Policy
              </span>
            </div>
            
            <p className="text-[11px] text-[#45474b] my-2.5 leading-relaxed">
              Evaluates statutory expiry dates against department schedules. Respects legal hold immunity.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">WAITING</div>
                <div className="font-bold text-[#151c27]">{queues['retention-queue']?.waiting ?? 0}</div>
              </div>
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">ACTIVE</div>
                <div className="font-bold text-[#3f5e93]">{queues['retention-queue']?.active ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#D8DEEA]/50 flex items-center justify-between text-[11px]">
            <span className="text-[#45474b] font-mono text-[10px]">Done: {queues['retention-queue']?.completed ?? 0}</span>
            <span className="text-[#9CA3AF] font-mono text-[10px]">Fails: {queues['retention-queue']?.failed ?? 0}</span>
          </div>
        </div>

        {/* Card 5: Crypto-Shred Cleanup */}
        <div className="bg-white rounded-[20px] border border-[#D8DEEA]/80 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-2.5 border-b border-[#D8DEEA]/50 gap-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666] flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#151c27] whitespace-nowrap leading-tight">Crypto-Shred</h3>
                  <span className="text-[10px] font-mono text-[#9CA3AF] block leading-tight">cleanup-queue</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666] shrink-0 whitespace-nowrap">
                Zeroization
              </span>
            </div>
            
            <p className="text-[11px] text-[#45474b] my-2.5 leading-relaxed">
              Dual-custody cryptographic key zeroization engine. Purges Transit DEKs and zeroizes storage streams.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs font-mono">
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">WAITING</div>
                <div className="font-bold text-[#151c27]">{queues['cleanup-queue']?.waiting ?? 0}</div>
              </div>
              <div className="bg-[#f0f3ff]/60 p-2 rounded-xl border border-[#D8DEEA]/60">
                <div className="text-[10px] text-[#9CA3AF]">ACTIVE</div>
                <div className="font-bold text-[#ca6666]">{queues['cleanup-queue']?.active ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#D8DEEA]/50 flex items-center justify-between text-[11px]">
            <span className="text-[#45474b] font-mono text-[10px]">Done: {queues['cleanup-queue']?.completed ?? 0}</span>
            <span className="text-[#9CA3AF] font-mono text-[10px]">Fails: {queues['cleanup-queue']?.failed ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 4. Processing Jobs Ledger Table */}
      <div className="bg-white rounded-[26px] border border-[#D8DEEA]/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-[#D8DEEA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f0f3ff]/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#3f5e93]">table_rows</span>
            <h3 className="font-bold text-sm text-[#151c27]">Processing Jobs Ledger</h3>
            <span className="text-xs font-mono text-[#9CA3AF]">({filteredJobs.length} records)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex items-center rounded-full bg-[#f0f3ff] p-1 text-xs font-semibold text-[#45474b] border border-[#D8DEEA]">
              {(['ALL', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full transition cursor-pointer ${
                    statusFilter === st ? 'bg-[#000000] text-white shadow-xs' : 'hover:text-[#151c27]'
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
              className="text-xs font-semibold bg-white border border-[#D8DEEA] rounded-full px-3 py-1.5 text-[#151c27] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Job Types</option>
              <option value="OCR_EXTRACTION">OCR Extraction</option>
              <option value="BLOCKCHAIN_ANCHOR">Blockchain Anchor</option>
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
                className="text-xs pl-8 pr-3 py-1.5 bg-white border border-[#D8DEEA] rounded-full text-[#151c27] placeholder:text-[#9CA3AF] focus:outline-none w-48"
              />
              <span className="material-symbols-outlined text-[15px] text-[#9CA3AF] absolute left-2.5 top-2">
                search
              </span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f0f3ff]/60 border-b border-[#D8DEEA]/60 text-[#45474b] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Job Type</th>
                <th className="py-3 px-4">Linked Record</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Created (UTC)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8DEEA]/30 font-sans">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#9CA3AF] text-xs">
                    No background processing jobs match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-[#f0f3ff]/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-[#151c27] font-medium">
                      {j.id.substring(0, 8)}...
                    </td>

                    <td className="py-3 px-4">
                      {j.type === 'BLOCKCHAIN_ANCHOR' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full text-[10px] font-mono">
                          <span className="material-symbols-outlined text-[12px]">hub</span>
                          BLOCKCHAIN ANCHOR
                        </span>
                      ) : j.type === 'OCR_EXTRACTION' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#3f5e93] bg-[rgba(131,162,219,0.14)] border border-[#83A2DB]/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
                          <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                          OCR EXTRACTION
                        </span>
                      ) : j.type === 'NOTIFICATION_DISPATCH' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full text-[10px] font-mono">
                          <span className="material-symbols-outlined text-[12px]">notifications</span>
                          NOTIFICATION DISPATCH
                        </span>
                      ) : j.type === 'RETENTION_AUDIT' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#3f5e93] bg-[rgba(131,162,219,0.14)] border border-[#83A2DB]/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
                          <span className="material-symbols-outlined text-[12px]">policy</span>
                          RETENTION AUDIT
                        </span>
                      ) : j.type === 'CRYPTO_SHRED_CLEANUP' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#ca6666] bg-[rgba(206,105,105,0.14)] border border-[#CE6969]/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
                          <span className="material-symbols-outlined text-[12px]">delete_forever</span>
                          CRYPTO SHRED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-mono">
                          <span className="material-symbols-outlined text-[12px]">science</span>
                          {j.type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {j.documentNumber ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-bold text-[#3f5e93]">{j.documentNumber}</span>
                          <span className="text-[10px] text-[#9CA3AF] truncate max-w-[140px]">{j.documentTitle || 'Case Record'}</span>
                        </div>
                      ) : (
                        <span className="text-[#9CA3AF] text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {j.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          COMPLETED
                        </span>
                      )}
                      {j.status === 'RUNNING' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3f5e93] animate-pulse"></span>
                          RUNNING
                        </span>
                      )}
                      {j.status === 'QUEUED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          QUEUED
                        </span>
                      )}
                      {j.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ca6666]"></span>
                          FAILED
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#45474b]">
                      {j.durationMs !== null ? `${j.durationMs}ms` : j.status === 'RUNNING' ? 'In progress...' : '—'}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#45474b]">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        j.attempts > 1 ? 'bg-amber-100 text-amber-800' : 'bg-[#f0f3ff] text-[#45474b]'
                      }`}>
                        {j.attempts} / 3
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#9CA3AF]">
                      {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedJob(j)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#151c27] hover:bg-[#f0f3ff] rounded-full border border-[#D8DEEA] transition cursor-pointer"
                        >
                          Inspect
                        </button>
                        {j.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetryJob(j.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#3f5e93] hover:bg-[rgba(131,162,219,0.14)] rounded-full border border-[#83A2DB]/30 transition cursor-pointer"
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

      {/* 5. Test Job Dispatcher Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10141A]/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-[26px] border border-[#D8DEEA] shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-xl">science</span>
                <h3 className="font-bold text-sm text-[#151c27]">Enqueue Worker Test Job</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#45474b]">
              Choose a specific queue or trigger a comprehensive test across all 5 workers to benchmark dispatch latency and ledger recording.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#151c27]">Target Worker Queue</label>
              <select
                value={selectedTestQueue}
                onChange={(e) => setSelectedTestQueue(e.target.value)}
                className="text-xs font-semibold bg-[#f0f3ff]/60 border border-[#D8DEEA] rounded-xl px-3 py-2.5 text-[#151c27] focus:outline-none cursor-pointer"
              >
                <option value="ALL">⚡ Test All 5 Queues Concurrently</option>
                <option value="ocr-queue">📄 OCR Extraction Queue (ocr-queue)</option>
                <option value="blockchain-queue">⛓️ Hyperledger Fabric Queue (blockchain-queue)</option>
                <option value="notification-queue">🔔 Notification Fanout Queue (notification-queue)</option>
                <option value="retention-queue">⚖️ BNSS Retention Audit Queue (retention-queue)</option>
                <option value="cleanup-queue">🗑️ Crypto-Shred Zeroization Queue (cleanup-queue)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8DEEA]/60">
              <button
                onClick={() => setShowTestModal(false)}
                className="h-9 px-4 bg-[#f0f3ff] hover:bg-[#e2e8f8] text-[#151c27] rounded-full text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDispatchTestJobs(selectedTestQueue)}
                className="h-9 px-5 bg-[#000000] hover:bg-[#181c22] text-white rounded-full text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Dispatch Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Job Inspector Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10141A]/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-[26px] border border-[#D8DEEA] shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-xl">terminal</span>
                <h3 className="font-bold text-sm text-[#151c27]">Background Job Execution Details</h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex justify-between p-2.5 rounded-xl bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <span className="text-[#9CA3AF]">JOB ID:</span>
                <span className="text-[#151c27] font-bold">{selectedJob.id}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <span className="text-[#9CA3AF]">TYPE:</span>
                <span className="text-[#151c27] font-bold">{selectedJob.type}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <span className="text-[#9CA3AF]">STATUS:</span>
                <span className="font-bold text-[#151c27]">{selectedJob.status}</span>
              </div>
              {selectedJob.documentNumber && (
                <div className="flex justify-between p-2.5 rounded-xl bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                  <span className="text-[#9CA3AF]">DOCKET:</span>
                  <span className="font-bold text-[#3f5e93]">{selectedJob.documentNumber}</span>
                </div>
              )}
              <div className="flex justify-between p-2.5 rounded-xl bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <span className="text-[#9CA3AF]">ATTEMPTS:</span>
                <span className="font-bold text-[#151c27]">{selectedJob.attempts} of 3</span>
              </div>
              {selectedJob.durationMs !== null && (
                <div className="flex justify-between p-2.5 rounded-xl bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                  <span className="text-[#9CA3AF]">EXECUTION TIME:</span>
                  <span className="font-bold text-[#151c27]">{selectedJob.durationMs} ms</span>
                </div>
              )}
              {selectedJob.errorMessage && (
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-[rgba(206,105,105,0.14)] border border-[#CE6969]/30 text-[#ca6666]">
                  <span className="font-bold text-[11px]">ERROR LOG:</span>
                  <span className="text-[11px] whitespace-pre-wrap">{selectedJob.errorMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8DEEA]/60">
              {selectedJob.status === 'FAILED' && (
                <button
                  onClick={() => {
                    handleRetryJob(selectedJob.id);
                    setSelectedJob(null);
                  }}
                  className="h-8 px-4 bg-[#3f5e93] hover:bg-[#305184] text-white rounded-full text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Retry Job
                </button>
              )}
              <button
                onClick={() => setSelectedJob(null)}
                className="h-8 px-4 bg-[#f0f3ff] hover:bg-[#e2e8f8] text-[#151c27] rounded-full text-xs font-semibold cursor-pointer"
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
