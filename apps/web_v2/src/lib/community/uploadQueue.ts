/**
 * Serial-ish media upload queue with weak-network awareness.
 * Large files wait for online / better connectivity instead of spinning retries.
 */

export type UploadQueuePhase =
  | 'queued'
  | 'waiting_network'
  | 'uploading'
  | 'done'
  | 'error';

export type UploadQueueStatus = {
  phase: UploadQueuePhase;
  /** 0–1 while uploading */
  progress?: number;
  message?: string;
};

type QueueJob<T> = {
  id: string;
  bytes: number;
  run: (onProgress: (ratio: number) => void) => Promise<T>;
  onStatus?: (status: UploadQueueStatus) => void;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

const LARGE_UPLOAD_BYTES = 2 * 1024 * 1024;
/** One heavy upload at a time (videos / big photos). */
const MAX_CONCURRENT = 1;

let active = 0;
const queue: QueueJob<unknown>[] = [];

type NetworkConnection = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function connection(): NetworkConnection | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/** True when we should delay starting a large upload. */
export function isWeakOrOfflineNetwork(): boolean {
  if (!isOnline()) return true;
  const c = connection();
  if (!c) return false;
  if (c.saveData) return true;
  const t = (c.effectiveType ?? '').toLowerCase();
  return t === 'slow-2g' || t === '2g';
}

function waitForUsableNetwork(signal: { cancelled: boolean }): Promise<void> {
  if (!isWeakOrOfflineNetwork()) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      if (signal.cancelled) return;
      if (isWeakOrOfflineNetwork()) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.removeEventListener('online', done);
      const c = connection();
      c?.removeEventListener?.('change', done);
    };
    window.addEventListener('online', done);
    connection()?.addEventListener?.('change', done);
    // Poll lightly — some WebViews omit connection events.
    const iv = window.setInterval(() => {
      if (signal.cancelled) {
        window.clearInterval(iv);
        cleanup();
        return;
      }
      if (!isWeakOrOfflineNetwork()) {
        window.clearInterval(iv);
        cleanup();
        resolve();
      }
    }, 1500);
  });
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    if (!job) return;
    active += 1;
    void (async () => {
      const cancel = { cancelled: false };
      try {
        const needsWait = job.bytes >= LARGE_UPLOAD_BYTES && isWeakOrOfflineNetwork();
        if (needsWait) {
          job.onStatus?.({
            phase: 'waiting_network',
            message: 'Waiting for a better connection…',
          });
          await waitForUsableNetwork(cancel);
        }
        job.onStatus?.({ phase: 'uploading', progress: 0, message: 'Uploading…' });
        const result = await job.run((ratio) => {
          job.onStatus?.({
            phase: 'uploading',
            progress: ratio,
            message: 'Uploading…',
          });
        });
        job.onStatus?.({ phase: 'done', progress: 1 });
        job.resolve(result);
      } catch (e) {
        job.onStatus?.({
          phase: 'error',
          message: e instanceof Error ? e.message : 'Upload failed',
        });
        job.reject(e);
      } finally {
        cancel.cancelled = true;
        active -= 1;
        pump();
      }
    })();
  }
}

/**
 * Enqueue an upload. Small files start immediately (subject to concurrency).
 * Large files on 2G/offline wait with `waiting_network` status.
 */
export function enqueueMediaUpload<T>(opts: {
  id?: string;
  bytes: number;
  run: (onProgress: (ratio: number) => void) => Promise<T>;
  onStatus?: (status: UploadQueueStatus) => void;
}): Promise<T> {
  const id = opts.id?.trim() || `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return new Promise<T>((resolve, reject) => {
    opts.onStatus?.({
      phase: 'queued',
      message:
        opts.bytes >= LARGE_UPLOAD_BYTES && isWeakOrOfflineNetwork()
          ? 'Waiting for a better connection…'
          : 'Queued…',
    });
    queue.push({
      id,
      bytes: opts.bytes,
      run: opts.run,
      onStatus: opts.onStatus,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    // If already waiting_network at enqueue for large+weak, reflect that.
    if (opts.bytes >= LARGE_UPLOAD_BYTES && isWeakOrOfflineNetwork()) {
      opts.onStatus?.({
        phase: 'waiting_network',
        message: 'Waiting for a better connection…',
      });
    }
    pump();
  });
}
