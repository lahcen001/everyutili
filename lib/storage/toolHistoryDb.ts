import { createStore, get, set, del, keys } from "idb-keyval";

/**
 * One completed operation's result for a given tool, stored entirely
 * client-side in IndexedDB. `blob` carries the actual file/image binary
 * (for instant re-download without re-running the tool); `data` carries
 * plain text/JSON payloads (e.g. formatted JSON, calculator summaries).
 * Both are optional — a tool uses whichever applies.
 */
export interface ToolHistoryItem {
  id: string;
  toolSlug: string;
  timestamp: number;
  /** e.g. "photo.jpg → photo.png (1.2 MB)" or "Annual: $95,000" */
  title: string;
  /** Key metrics or parameters, shown as secondary text. */
  summary: string;
  /** Formatted text or JSON string, for "Copy" / "Restore Inputs". */
  data?: string;
  /** Image/PDF binary, for "Re-Download". */
  blob?: Blob;
}

const MAX_ITEMS_PER_TOOL = 5;

// Dedicated IndexedDB database/store, separate from any other idb-keyval
// consumer in the app. Keys are `${toolSlug}:${id}` so all of one tool's
// history can be listed via a prefix scan over `keys()`.
const historyStore = createStore("omnitools-history", "tool-results");

function entryKey(toolSlug: string, id: string): string {
  return `${toolSlug}:${id}`;
}

function generateId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Saves a new result for `toolSlug`, then prunes so only the newest
 * `MAX_ITEMS_PER_TOOL` (5) entries for that tool remain — older entries
 * (and their blobs) are deleted from IndexedDB, not just hidden.
 */
export async function saveToolResult(
  toolSlug: string,
  entry: Omit<ToolHistoryItem, "id" | "timestamp" | "toolSlug">
): Promise<ToolHistoryItem> {
  const item: ToolHistoryItem = {
    ...entry,
    id: generateId(),
    toolSlug,
    timestamp: Date.now(),
  };

  await set(entryKey(toolSlug, item.id), item, historyStore);
  await pruneToolHistory(toolSlug);

  return item;
}

/**
 * Returns up to 5 entries for `toolSlug`, newest first.
 */
export async function getToolHistory(toolSlug: string): Promise<ToolHistoryItem[]> {
  const allKeys = await keys<string>(historyStore);
  const prefix = `${toolSlug}:`;
  const toolKeys = allKeys.filter((k) => k.startsWith(prefix));

  const items = await Promise.all(
    toolKeys.map((k) => get<ToolHistoryItem>(k, historyStore))
  );

  return items
    .filter((item): item is ToolHistoryItem => Boolean(item))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ITEMS_PER_TOOL);
}

async function pruneToolHistory(toolSlug: string): Promise<void> {
  const allKeys = await keys<string>(historyStore);
  const prefix = `${toolSlug}:`;
  const toolKeys = allKeys.filter((k) => k.startsWith(prefix));

  if (toolKeys.length <= MAX_ITEMS_PER_TOOL) return;

  const items = await Promise.all(
    toolKeys.map(async (k) => ({ key: k, item: await get<ToolHistoryItem>(k, historyStore) }))
  );

  const sorted = items
    .filter((entry): entry is { key: string; item: ToolHistoryItem } => Boolean(entry.item))
    .sort((a, b) => b.item.timestamp - a.item.timestamp);

  const toDelete = sorted.slice(MAX_ITEMS_PER_TOOL);
  await Promise.all(toDelete.map((entry) => del(entry.key, historyStore)));
}

export async function deleteToolHistoryItem(toolSlug: string, id: string): Promise<void> {
  await del(entryKey(toolSlug, id), historyStore);
}

export async function clearToolHistory(toolSlug: string): Promise<void> {
  const allKeys = await keys<string>(historyStore);
  const prefix = `${toolSlug}:`;
  const toolKeys = allKeys.filter((k) => k.startsWith(prefix));
  await Promise.all(toolKeys.map((k) => del(k, historyStore)));
}
