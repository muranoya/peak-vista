/**
 * Map View Manager
 * Handles 2D map display with zoom and pan controls
 */

export class MapViewManager {
    constructor(coordinateTransform) {
        this.coordinateTransform = coordinateTransform;

        // Map state
        this.zoomLevel = 8; // 8-15
        this.centerLat = 36.5; // Japan center
        this.centerLon = 138.0;

        // Map constraints
        this.minZoom = 5;
        this.maxZoom = 15;

        // Tile size (256px)
        this.tileSize = 256;

        // Canvas state
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // Loaded tiles map: key -> {url, image}
        this.loadedTiles = new Map();

        // Pan state
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartLat = 0;
        this.panStartLon = 0;
    }

    /**
     * Initialize map for a canvas
     */
    init(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    /**
     * Set zoom level
     */
    setZoom(zoom) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }

    /**
     * Change zoom by delta
     */
    changeZoom(delta) {
        this.setZoom(this.zoomLevel + delta);
    }

    /**
     * Set center position
     */
    setCenter(lat, lon) {
        this.centerLat = Math.max(-85, Math.min(85, lat));
        this.centerLon = ((lon + 180) % 360) - 180;
    }

    /**
     * Pan by pixel offset
     */
    panByPixels(deltaPixelX, deltaPixelY) {
        // Convert pixels to tiles
        const deltaTileX = deltaPixelX / this.tileSize;
        const deltaTileY = deltaPixelY / this.tileSize;

        // Convert center to tile coordinates
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(this.centerLon, this.zoomLevel);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(this.centerLat, this.zoomLevel);

        // Update tile coordinates
        const newTileX = centerTileX - deltaTileX;
        const newTileY = centerTileY - deltaTileY;

        // Convert back to lat/lon
        const latlon = this.tileToLatLon(newTileX, newTileY);
        this.setCenter(latlon.lat, latlon.lon);
    }

    /**
     * Get meters per pixel at current zoom
     */
    getMetersPerPixel() {
        const earthCircumference = 40075016.686; // meters
        const numTiles = Math.pow(2, this.zoomLevel);
        const worldWidthMeters = earthCircumference;
        const pixelsAtZoom = numTiles * this.tileSize;
        return worldWidthMeters / pixelsAtZoom;
    }

    /**
     * Get meters per degree longitude at given latitude
     */
    getMetersPerLonDegree(lat) {
        const earthCircumference = 40075016.686;
        const latRad = (lat * Math.PI) / 180;
        return (earthCircumference * Math.cos(latRad)) / 360;
    }

    /**
     * Get tiles needed for current viewport
     */
    getVisibleTiles() {
        const numTiles = Math.pow(2, this.zoomLevel);

        // Convert center to tile coordinates
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(this.centerLon, this.zoomLevel);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(this.centerLat, this.zoomLevel);

        // How many tiles fit in viewport (with buffer)
        const tilesAcrossX = Math.ceil(this.canvasWidth / this.tileSize) + 2;
        const tilesAcrossY = Math.ceil(this.canvasHeight / this.tileSize) + 2;

        const tiles = [];
        const startX = Math.floor(centerTileX - tilesAcrossX / 2);
        const startY = Math.floor(centerTileY - tilesAcrossY / 2);

        for (let y = startY; y < startY + tilesAcrossY; y++) {
            for (let x = startX; x < startX + tilesAcrossX; x++) {
                // Wrap around for longitude
                const wrappedX = ((x % numTiles) + numTiles) % numTiles;

                // Skip out of bounds latitude tiles
                if (y < 0 || y >= numTiles) {
                    continue;
                }

                tiles.push({
                    z: this.zoomLevel,
                    x: wrappedX,
                    y: y,
                });
            }
        }

        return tiles;
    }

    /**
     * Get tile URL (standard map)
     */
    getTileUrl(z, x, y) {
        return `https://cyberjapandata.gsi.go.jp/xyz/std/${z}/${x}/${y}.png`;
    }

    /**
     * Get DEM tile URL
     */
    getDEMTileUrl(z, x, y) {
        return `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${z}/${x}/${y}.png`;
    }

    /**
     * Convert screen pixel to lat/lon
     */
    pixelToLatLon(pixelX, pixelY) {
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(this.centerLon, this.zoomLevel);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(this.centerLat, this.zoomLevel);

        // Offset from center
        const offsetX = pixelX - this.canvasWidth / 2;
        const offsetY = pixelY - this.canvasHeight / 2;

        // Convert to tile coordinates
        const tileX = centerTileX + offsetX / this.tileSize;
        const tileY = centerTileY + offsetY / this.tileSize;

        // Convert back to lat/lon
        return this.tileToLatLon(tileX, tileY);
    }

    /**
     * Convert tile coordinates to lat/lon
     */
    tileToLatLon(tileX, tileY) {
        const n = Math.pow(2.0, this.zoomLevel);

        // Longitude
        const lon = (tileX / n) * 360.0 - 180.0;

        // Latitude
        const lat = Math.atan(Math.sinh(Math.PI * (1.0 - (2.0 * tileY) / n)));
        const latDeg = (lat * 180.0) / Math.PI;

        return { lat: latDeg, lon: lon };
    }

    /**
     * Get state for debugging
     */
    getState() {
        return {
            zoom: this.zoomLevel,
            center: { lat: this.centerLat, lon: this.centerLon },
            visibleTiles: this.getVisibleTiles().length,
        };
    }
}
