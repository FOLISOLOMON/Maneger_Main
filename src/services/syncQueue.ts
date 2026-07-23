// Veloura Manager V2 — Background Sync Queue
// Queue mutations offline and replay them automatically when connectivity returns.

import type { ApiRecord } from '../types';
import { postAction } from '../lib/sheets';

const QUEUE_KEY = 'syncQueue';
const MAX_QUEUE_SIZE = 500;
const MAX_RETRIES = 3;

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  flush: () => Promise<void>;
}

export interface QueueItem {
  id: string;
  action: string;
  params: ApiRecord;
  createdAt: number;
  retries: number;
}

function readQueue(): QueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueueItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(action: string, params: ApiRecord): void {
  const queue = readQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
  }
  const item: QueueItem = {
    id: crypto.randomUUID(),
    action,
    params,
    createdAt: Date.now(),
    retries: 0,
  };
  queue.push(item);
  writeQueue(queue);
}

export async function flush(): Promise<void> {
  if (typeof window === 'undefined') return;
  const queue = readQueue();
  if (!queue.length) return;

  const remaining: QueueItem[] = [];
  for (const item of queue) {
    try {
      await postAction(item.action, item.params);
    } catch (err) {
      item.retries += 1;
      if (item.retries >= MAX_RETRIES) {
        console.error('Sync queue item failed after max retries:', item, err);
      } else {
        remaining.push(item);
      }
    }
  }
  writeQueue(remaining);
}

const listeners: Set<() => void> = new Set();
export function onStatusChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const queue = readQueue();
  const pendingCount = queue.length;

  return {
    isOnline,
    pendingCount,
    failedCount: 0,
    flush,
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyListeners();
    flush();
  });
  window.addEventListener('offline', notifyListeners);
}
