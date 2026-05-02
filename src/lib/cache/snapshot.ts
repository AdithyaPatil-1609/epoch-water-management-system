export class SnapshotCache {
 private static store = new Map<string, { value: any; expiry: number }>();

 /** Get cached value, or null if expired or missing */
 static get<T>(key: string): T | null {
  const cached = this.store.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiry) {
   this.store.delete(key);
   return null;
  }
  return cached.value as T;
 }

 /** Store value with TTL */
 static set<T>(key: string, value: T, ttlSeconds: number = 30): void {
  this.store.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
 }

 /** Clear a specific key */
 static clear(key: string): void {
  this.store.delete(key);
 }
}
