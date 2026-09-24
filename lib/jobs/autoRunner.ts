import { JobRunner } from './jobRunner';

/**
 * AutoJobRunner provides an automatic, non-blocking dispatcher loop for background queues.
 * Ensures enqueued tasks transition immediately from QUEUED -> RUNNING -> COMPLETED
 * without requiring manual user tick execution.
 */
export class AutoJobRunner {
  private static isDraining = false;
  private static hasPendingTrigger = false;
  private static intervalStarted = false;
  private static intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Initializes the recurring background sweep timer (runs every 3 seconds).
   */
  public static init() {
    if (this.intervalStarted) return;
    this.intervalStarted = true;

    if (typeof setInterval !== 'undefined') {
      this.intervalTimer = setInterval(() => {
        this.trigger();
      }, 3000);

      if (this.intervalTimer && typeof this.intervalTimer.unref === 'function') {
        this.intervalTimer.unref();
      }
    }
  }

  /**
   * Trigger an immediate, non-blocking drain pass across all 5 queues.
   * Concurrency-safe: if already draining, marks a pending trigger to run on completion.
   */
  public static trigger() {
    this.init();

    if (this.isDraining) {
      this.hasPendingTrigger = true;
      return;
    }

    this.isDraining = true;
    this.hasPendingTrigger = false;

    // Execute asynchronously on the microtask / event queue
    Promise.resolve().then(async () => {
      try {
        await JobRunner.drainQueues(50);
      } catch (err: any) {
        console.warn('[AUTO_JOB_RUNNER_WARN] Queue drain error:', err.message);
      } finally {
        this.isDraining = false;
        if (this.hasPendingTrigger) {
          this.hasPendingTrigger = false;
          // Run another pass if more jobs were enqueued during draining
          setTimeout(() => this.trigger(), 50);
        }
      }
    });
  }
}

// Auto-initialize background runner timer upon module import (server-side only)
if (typeof window === 'undefined') {
  AutoJobRunner.init();
}
