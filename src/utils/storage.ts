// Safe storage utility with automatic QuotaExceededError protection and fallback

const inMemoryStore: Record<string, string> = {};

/**
 * Safely saves a key-value pair to localStorage.
 * If quota is exceeded, it prunes bloated data from conversations and retries.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    delete inMemoryStore[key];
    return true;
  } catch (err: any) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    if (isQuota) {
      console.warn(`[NEXUS Storage] QuotaExceededError ao salvar "${key}". Liberando espaço...`);
      // Attempt recovery: prune bloated conversations from localStorage
      try {
        pruneStorageToFreeSpace();
        localStorage.setItem(key, value);
        delete inMemoryStore[key];
        return true;
      } catch (retryErr) {
        // Fallback to in-memory store so the app never throws runtime errors
        console.warn(`[NEXUS Storage] Armazenando "${key}" na memória temporária da sessão.`);
        inMemoryStore[key] = value;
        return false;
      }
    }

    inMemoryStore[key] = value;
    return false;
  }
}

/**
 * Safely gets an item from localStorage or in-memory fallback.
 */
export function safeGetItem(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch {}
  return inMemoryStore[key] ?? null;
}

/**
 * Safely removes an item.
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
  delete inMemoryStore[key];
}

/**
 * Prunes storage by cleaning heavy attachments and trimming old conversations.
 */
export function pruneStorageToFreeSpace(): void {
  const CONV_KEY = 'nexus_conversations_v1';
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (!raw) return;

    const convs = JSON.parse(raw);
    if (!Array.isArray(convs)) return;

    // 1. Strip raw base64 data and oversized thumbnails from all messages
    const stripped = convs.map((c: any) => ({
      ...c,
      messages: (c.messages || []).map((m: any) => ({
        ...m,
        attachments: m.attachments?.map((att: any) => ({
          id: att.id,
          name: att.name,
          type: att.type,
          mimeType: att.mimeType,
          size: att.size,
          durationSec: att.durationSec,
          // Strip massive base64 payloads
          dataUrl: att.dataUrl && att.dataUrl.length > 50000 ? '' : att.dataUrl,
          base64Data: '',
        })),
      })),
    }));

    // 2. Keep the most recent 25 conversations if still too large
    const trimmed = stripped.slice(0, 25);
    localStorage.setItem(CONV_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // If even that fails, clear only non-essential conversation caches
    try {
      localStorage.removeItem(CONV_KEY);
    } catch {}
  }
}
