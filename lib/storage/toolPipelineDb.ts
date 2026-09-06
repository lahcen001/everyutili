import { createStore, get, set, del } from "idb-keyval";

/**
 * "Send to next tool" handoff: a short-lived, single-read stash for one
 * result blob passed from one tool page to another, so the destination tool
 * can pick up right where the source left off instead of the user
 * re-downloading and re-uploading the same file.
 *
 * Deliberately separate from lib/storage/toolHistoryDb.ts — that store is a
 * persistent, capped "last 5 results" history; this one is a transient
 * mailbox, always exactly one pending item, consumed (read + deleted) at
 * most once. Kept in IndexedDB rather than sessionStorage because a Blob
 * can't be stored in sessionStorage without an expensive base64 round-trip.
 */
export interface PipelineHandoff {
  /** Human-readable result name, e.g. "photo-compressed.jpg". */
  fileName: string;
  blob: Blob;
  /** Slug of the tool that produced this result, for provenance/analytics-free context only. */
  fromSlug: string;
  createdAt: number;
}

const HANDOFF_KEY = "pending";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes — stale handoffs are dropped, not carried forward indefinitely.

const pipelineStore = createStore("everyutili-pipeline", "handoff");

/**
 * Stashes a result for pickup by another tool page, returning an opaque id
 * to put in that page's URL (`?from=<id>`). Overwrites any previous pending
 * handoff — only one is ever in flight, since a user only navigates to one
 * "next" tool at a time.
 */
export async function stashHandoff(
  blob: Blob,
  fileName: string,
  fromSlug: string
): Promise<string> {
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handoff: PipelineHandoff = { fileName, blob, fromSlug, createdAt: Date.now() };
  await set(HANDOFF_KEY, { id, handoff }, pipelineStore);
  return id;
}

/**
 * Reads and immediately deletes the pending handoff if its id matches and
 * it hasn't expired. Returns null otherwise (wrong/missing id, already
 * consumed, or stale) — callers should treat null as "nothing to do",
 * never as an error.
 */
export async function consumeHandoff(id: string): Promise<PipelineHandoff | null> {
  const stored = await get<{ id: string; handoff: PipelineHandoff }>(HANDOFF_KEY, pipelineStore);
  if (!stored || stored.id !== id) return null;

  await del(HANDOFF_KEY, pipelineStore);

  if (Date.now() - stored.handoff.createdAt > MAX_AGE_MS) return null;
  return stored.handoff;
}
