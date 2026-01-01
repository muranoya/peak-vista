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
     * Zoom at a specific pixel point (cursor-relative zoom)
     * @param {number} zoomDelta - Amount to zoom
     * @param {number} pixelX - Cursor X position (screen coordinates)
     * @param {number} pixelY - Cursor Y position (screen coordinates)
     */
    zoomAtPoint(zoomDelta, pixelX, pixelY) {
        // Get the cursor position in map coordinates before zoom
        const beforeZoomLatLon = this.pixelToLatLon(pixelX, pixelY);

        // Apply zoom
        const oldZoom = this.zoomLevel;
        this.setZoom(this.zoomLevel + zoomDelta);

        // Get the cursor position in map coordinates after zoom
        const afterZoomLatLon = this.pixelToLatLon(pixelX, pixelY);

        // Calculate the difference and adjust center to keep cursor at same position
        const latDiff = afterZoomLatLon.lat - beforeZoomLatLon.lat;
        const lonDiff = afterZoomLatLon.lon - beforeZoomLatLon.lon;

        this.centerLat = this.centerLat - latDiff;
        this.centerLon = this.centerLon - lonDiff;

        // Clamp center within valid bounds
        this.centerLat = Math.max(-85, Math.min(85, this.centerLat));
        this.centerLon = ((this.centerLon + 180) % 360) - 180;
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
        // Convert pixels to map coordinates
        // At zoom level, calculate how much each pixel represents
        const zoomLevel = Math.round(this.zoomLevel);
        
        // Get the scale factor: how many tile units per pixel at this zoom
        // Each tile is 256 pixels and covers 360/2^zoom degrees in longitude
        const numTiles = Math.pow(2, zoomLevel);
        const degreesPerTile = 360 / numTiles;
        const degreesPerPixel = degreesPerTile / 256;

        // Convert pixel delta to degree delta
        // Positive deltaPixelX (drag right) moves center right (positive longitude)
        const lonDelta = deltaPixelX * degreesPerPixel;
        
        // For latitude, it's more complex due to Web Mercator projection
        // But we can approximate: at the equator, lon and lat have same degree-to-pixel ratio
        // Adjusted for latitude: varies with cos(lat)
        const latRadians = (this.centerLat * Math.PI) / 180;
        const latDegreesPerPixel = degreesPerPixel / Math.cos(latRadians);
        const latDelta = -deltaPixelY * latDegreesPerPixel; // Negative because Y is inverted in screens

        // Update center position
        this.centerLon = this.centerLon + lonDelta;
        this.centerLat = this.centerLat + latDelta;

        // Clamp within valid bounds
        this.centerLat = Math.max(-85, Math.min(85, this.centerLat));
        this.centerLon = ((this.centerLon + 180) % 360) - 180;
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
        // Use integer zoom level for tile calculations
        const zoomLevel = Math.round(this.zoomLevel);
        const numTiles = Math.pow(2, zoomLevel);

        // Convert center to tile coordinates
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(this.centerLon, zoomLevel);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(this.centerLat, zoomLevel);

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
                    z: zoomLevel,
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
        const zoomLevel = Math.round(this.zoomLevel);
        const centerTileX = this.coordinateTransform.latlon_to_tile_x(this.centerLon, zoomLevel);
        const centerTileY = this.coordinateTransform.latlon_to_tile_y(this.centerLat, zoomLevel);

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
        const zoomLevel = Math.round(this.zoomLevel);
        const n = Math.pow(2.0, zoomLevel);

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

    /**
     * Log current map state for debugging
     */
    logState() {
        const state = this.getState();
        console.log(`🗺️ Map State:
  Zoom: ${state.zoom.toFixed(2)}
  Center: ${state.center.lat.toFixed(4)}°, ${state.center.lon.toFixed(4)}°
  Visible Tiles: ${state.visibleTiles}
  Zoom constraints: ${this.minZoom}-${this.maxZoom}`);
    }
}
