export type CachedArtwork = {
  buffer: Buffer;
  contentType: string;
};

type Entry = CachedArtwork & { expiresAt: number; size: number };

export class ArtworkCache {
  private entries = new Map<string, Entry>();
  private totalBytes = 0;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxEntries = 256,
    private readonly maxBytes = 48 * 1024 * 1024,
    private readonly ttlMs = 6 * 60 * 60 * 1000,
  ) {}

  get(key: string, now = Date.now()): CachedArtwork | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { buffer: entry.buffer, contentType: entry.contentType };
  }

  stats(): { entries: number; bytes: number; hits: number; misses: number } {
    return { entries: this.entries.size, bytes: this.totalBytes, hits: this.hits, misses: this.misses };
  }

  set(key: string, value: CachedArtwork, now = Date.now()): void {
    this.delete(key);
    const entry = { ...value, size: value.buffer.byteLength, expiresAt: now + this.ttlMs };
    this.entries.set(key, entry);
    this.totalBytes += entry.size;
    while (this.entries.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.delete(oldest);
    }
  }

  private delete(key: string): void {
    const existing = this.entries.get(key);
    if (!existing) return;
    this.totalBytes -= existing.size;
    this.entries.delete(key);
  }
}
