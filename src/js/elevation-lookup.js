/**
 * Elevation Lookup
 * Retrieves elevation data at a given lat/lon point
 */

export class ElevationLookup {
    constructor(networkFetcher, elevationParser, coordinateTransform) {
        this.networkFetcher = networkFetcher;
        this.elevationParser = elevationParser;
        this.coordinateTransform = coordinateTransform;

        // Cache for elevation tiles
        this.cache = new Map();
        this.maxCacheSize = 50;
    }

    /**
     * Get elevation at lat/lon point
     */
    async getElevation(lat, lon, zoomLevel = 14) {
        try {
            // Get tile coordinates
            const tileX = Math.floor(this.coordinateTransform.latlon_to_tile_x(lon, zoomLevel));
            const tileY = Math.floor(this.coordinateTransform.latlon_to_tile_y(lat, zoomLevel));

            // Fetch elevation tile
            const tileData = await this.getElevationTile(zoomLevel, tileX, tileY);

            if (!tileData) {
                console.warn(`Failed to load elevation tile ${zoomLevel}/${tileX}/${tileY}`);
                return null;
            }

            // Parse elevation data
            const elevations = this.elevationParser.parse_png(new Uint8Array(tileData));

            // Get pixel position within tile
            const pixelPos = this.getPixelInTile(lat, lon, zoomLevel, tileX, tileY);

            // Bilinear interpolation to get elevation at point
            const elevation = this.bilinearInterpolate(elevations, pixelPos.x, pixelPos.y);

            return elevation;
        } catch (error) {
            console.error(`Failed to get elevation at ${lat}, ${lon}:`, error);
            return null;
        }
    }

    /**
     * Get elevation tile data (with caching)
     */
    async getElevationTile(z, x, y) {
        const key = `${z}/${x}/${y}`;

        // Check cache
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            // Fetch from network
            const data = await this.networkFetcher.fetchTile(z, x, y);

            // Store in cache
            this.addToCache(key, data);

            return data;
        } catch (error) {
            console.warn(`Failed to fetch elevation tile ${key}:`, error);
            return null;
        }
    }

    /**
     * Add tile to cache with LRU eviction
     */
    addToCache(key, data) {
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, data);
    }

    /**
     * Get pixel position within tile for lat/lon point
     */
    getPixelInTile(lat, lon, z, tileX, tileY) {
        // Convert tile coordinates to lat/lon bounds
        const n = Math.pow(2, z);

        // Tile bounds
        const west = (tileX / n) * 360 - 180;
        const east = ((tileX + 1) / n) * 360 - 180;

        const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
        const northLat = (northRad * 180) / Math.PI;

        const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / n)));
        const southLat = (southRad * 180) / Math.PI;

        // Calculate pixel position (0-255)
        const pixelX = ((lon - west) / (east - west)) * 255;
        const pixelY = ((northLat - lat) / (northLat - southLat)) * 255;

        return {
            x: Math.max(0, Math.min(255, pixelX)),
            y: Math.max(0, Math.min(255, pixelY)),
        };
    }

    /**
     * Bilinear interpolation for elevation data
     */
    bilinearInterpolate(elevations, x, y) {
        // Get integer and fractional parts
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;

        // Clamp to valid range
        const x0 = Math.max(0, Math.min(254, xi));
        const x1 = Math.max(0, Math.min(254, xi + 1));
        const y0 = Math.max(0, Math.min(254, yi));
        const y1 = Math.max(0, Math.min(254, yi + 1));

        // Get the four surrounding elevation values
        // Array is organized as 256x256 = 65536 values
        const idx00 = y0 * 256 + x0;
        const idx10 = y0 * 256 + x1;
        const idx01 = y1 * 256 + x0;
        const idx11 = y1 * 256 + x1;

        const e00 = elevations[idx00] || 0;
        const e10 = elevations[idx10] || 0;
        const e01 = elevations[idx01] || 0;
        const e11 = elevations[idx11] || 0;

        // Bilinear interpolation
        const e0 = e00 * (1 - xf) + e10 * xf;
        const e1 = e01 * (1 - xf) + e11 * xf;
        const elevation = e0 * (1 - yf) + e1 * yf;

        return elevation;
    }

    /**
     * Get elevation at multiple points (batch)
     */
    async getElevations(points, zoomLevel = 14) {
        // Group by tile to minimize requests
        const byTile = new Map();

        for (const point of points) {
            const tileX = Math.floor(this.coordinateTransform.latlon_to_tile_x(point.lon, zoomLevel));
            const tileY = Math.floor(this.coordinateTransform.latlon_to_tile_y(point.lat, zoomLevel));
            const key = `${zoomLevel}/${tileX}/${tileY}`;

            if (!byTile.has(key)) {
                byTile.set(key, []);
            }
            byTile.get(key).push({ ...point, tileX, tileY });
        }

        // Fetch tiles
        const results = [];
        for (const [tileKey, tilePoints] of byTile) {
            const [z, x, y] = tileKey.split('/').map(Number);
            const tileData = await this.getElevationTile(z, x, y);

            if (tileData) {
                const elevations = this.elevationParser.parse_png(new Uint8Array(tileData));

                for (const point of tilePoints) {
                    const pixelPos = this.getPixelInTile(point.lat, point.lon, z, x, y);
                    const elevation = this.bilinearInterpolate(elevations, pixelPos.x, pixelPos.y);
                    results.push({
                        ...point,
                        elevation,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    getCacheSize() {
        return this.cache.size;
    }
}
