/**
 * Tile Cache Manager
 * Implements 3-tier caching strategy:
 * 1. Memory cache (Map): 50ms, LRU, max 100 tiles
 * 2. IndexedDB: 200ms, unlimited
 * 3. Network: 5000ms, GSI API
 */

export class TileCacheManager {
    constructor(dbName = 'PeakVistaTileCache', maxMemoryTiles = 100) {
        this.dbName = dbName;
        this.dbVersion = 1;
        this.storeName = 'tiles';
        this.maxMemoryTiles = maxMemoryTiles;

        // Memory cache (LRU)
        this.memoryCache = new Map();
        this.accessOrder = [];

        this.db = null;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Generate cache key
     */
    getCacheKey(z, x, y) {
        return `${z}/${x}/${y}`;
    }

    /**
     * Get tile from cache (memory first, then IndexedDB)
     */
    async getTile(z, x, y) {
        const key = this.getCacheKey(z, x, y);

        // Check memory cache first
        if (this.memoryCache.has(key)) {
            this.updateAccessOrder(key);
            return this.memoryCache.get(key);
        }

        // Check IndexedDB
        if (this.db) {
            const data = await this.getTileFromIndexedDB(key);
            if (data) {
                // Promote to memory cache
                this.addToMemoryCache(key, data);
                return data;
            }
        }

        return null;
    }

    /**
     * Get tile from IndexedDB
     */
    async getTileFromIndexedDB(key) {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onerror = () => reject(new Error(`Failed to get tile ${key}`));
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.data : null);
            };
        });
    }

    /**
     * Store tile in cache (memory + IndexedDB)
     */
    async storeTile(z, x, y, data) {
        const key = this.getCacheKey(z, x, y);

        // Store in memory cache
        this.addToMemoryCache(key, data);

        // Store in IndexedDB
        if (this.db) {
            await this.storeTileToIndexedDB(key, data);
        }
    }

    /**
     * Add tile to memory cache with LRU eviction
     */
    addToMemoryCache(key, data) {
        // Remove if already exists
        if (this.memoryCache.has(key)) {
            this.memoryCache.delete(key);
            this.accessOrder = this.accessOrder.filter((k) => k !== key);
        }

        // Add to cache
        this.memoryCache.set(key, data);
        this.accessOrder.push(key);

        // Evict LRU if over limit
        if (this.memoryCache.size > this.maxMemoryTiles) {
            const lruKey = this.accessOrder.shift();
            this.memoryCache.delete(lruKey);
        }
    }

    /**
     * Update access order for LRU
     */
    updateAccessOrder(key) {
        this.accessOrder = this.accessOrder.filter((k) => k !== key);
        this.accessOrder.push(key);
    }

    /**
     * Store tile to IndexedDB
     */
    async storeTileToIndexedDB(key, data) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ key, data, timestamp: Date.now() });

            request.onerror = () => reject(new Error(`Failed to store tile ${key}`));
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Clear all memory cache
     */
    clearMemoryCache() {
        this.memoryCache.clear();
        this.accessOrder = [];
    }

    /**
     * Clear all IndexedDB cache
     */
    async clearIndexedDBCache() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onerror = () => reject(new Error('Failed to clear IndexedDB'));
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Clear all cache
     */
    async clearAll() {
        this.clearMemoryCache();
        await this.clearIndexedDBCache();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memoryCacheSize: this.memoryCache.size,
            maxMemoryTiles: this.maxMemoryTiles,
        };
    }

    /**
     * Evict tiles older than specified age (ms)
     */
    async evictOldTiles(maxAge = 7 * 24 * 60 * 60 * 1000) {
        // 7 days by default
        if (!this.db) return;

        const now = Date.now();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onerror = () => reject(new Error('Failed to evict old tiles'));
            request.onsuccess = () => {
                const tiles = request.result;
                tiles.forEach((tile) => {
                    if (now - tile.timestamp > maxAge) {
                        store.delete(tile.key);
                    }
                });
                resolve();
            };
        });
    }
}
