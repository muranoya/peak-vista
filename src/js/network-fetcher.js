export class NetworkFetcher {
    constructor(options = {}) {
        this.baseUrl = 'https://cyberjapandata.gsi.go.jp/xyz';
        this.format = options.format || 'dem_png'; // 'dem_png' or 'dem'
        this.timeout = options.timeout || 5000;
        this.retries = options.retries || 3;
    }

    /**
     * Fetch elevation tile from GSI
     * @param {number} z - Zoom level
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @returns {Promise<ArrayBuffer>} PNG or text data
     */
    async fetchTile(z, x, y) {
        const url = this.getTileUrl(z, x, y);
        return this.fetchWithRetry(url);
    }

    /**
     * Get tile URL for given coordinates
     */
    getTileUrl(z, x, y) {
        const ext = this.format === 'dem_png' ? 'png' : 'txt';
        return `${this.baseUrl}/${this.format}/${z}/${x}/${y}.${ext}`;
    }

    /**
     * Fetch with retry logic and timeout
     */
    async fetchWithRetry(url, attempt = 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept-Encoding': 'gzip, deflate',
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // 404 means tile doesn't exist, don't retry
                if (response.status === 404) {
                    throw new Error(`Tile not found (HTTP 404): ${url}`);
                }
                // 5xx errors are server errors, should retry
                if (response.status >= 500) {
                    throw new Error(`Server error (HTTP ${response.status}): ${response.statusText}`);
                }
                // Other errors may not be retriable
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.arrayBuffer();
        } catch (error) {
            // Don't retry for 404s
            if (error.message.includes('404')) {
                throw error;
            }

            if (attempt < this.retries - 1) {
                // Exponential backoff with jitter
                const baseDelay = Math.pow(2, attempt) * 1000;
                const jitter = Math.random() * baseDelay * 0.1;
                const delay = baseDelay + jitter;

                console.warn(
                    `Fetch failed for ${url}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.retries}):`,
                    error.message
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.fetchWithRetry(url, attempt + 1);
            } else {
                throw new Error(
                    `Failed to fetch tile after ${this.retries} attempts: ${error.message}`
                );
            }
        }
    }

    /**
     * Fetch multiple tiles in parallel
     */
    async fetchTiles(tiles) {
        return Promise.all(
            tiles.map((tile) => this.fetchTile(tile.z, tile.x, tile.y).then((data) => ({ ...tile, data })))
        );
    }

    /**
     * Check if tile exists at GSI (using HEAD request)
     */
    async tileExists(z, x, y) {
        try {
            const url = this.getTileUrl(z, x, y);
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
