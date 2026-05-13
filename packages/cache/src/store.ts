export interface CacheStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
}

interface Entry { value: unknown; expiresAt: number }

export class MemoryStore implements CacheStore {
  private readonly _map = new Map<string, Entry>();

  async get(key: string): Promise<unknown | undefined> {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this._map.delete(key); return undefined; }
    return entry.value;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this._map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

export const defaultStore = new MemoryStore();
