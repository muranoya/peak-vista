/**
 * Leaflet Map View Manager
 * Simplified wrapper around Leaflet map state
 */

export class MapViewManager {
    constructor(mapRenderer) {
        this.mapRenderer = mapRenderer;
        this.map = mapRenderer.map;
    }

    /**
     * Get current zoom level
     */
    get zoomLevel() {
        return this.map.getZoom();
    }

    /**
     * Set zoom level
     */
    set zoomLevel(zoom) {
        this.map.setZoom(zoom);
    }

    /**
     * Get center latitude
     */
    get centerLat() {
        return this.map.getCenter().lat;
    }

    /**
     * Get center longitude
     */
    get centerLon() {
        return this.map.getCenter().lng;
    }

    /**
     * Set center position
     */
    setCenter(lat, lon) {
        this.map.setView([lat, lon]);
    }

    /**
     * Pan by pixel offset
     */
    panByPixels(deltaPixelX, deltaPixelY) {
        // Pan using Leaflet's panBy method
        this.map.panBy([-deltaPixelX, -deltaPixelY], { animate: false });
    }

    /**
     * Zoom at a specific pixel point (cursor-relative zoom)
     */
    zoomAtPoint(zoomDelta, pixelX, pixelY) {
        // Get center before zoom
        const beforeZoomLatLon = this.mapRenderer.getTileAtPixel(pixelX, pixelY);
        
        // Apply zoom
        const newZoom = Math.max(5, Math.min(15, this.map.getZoom() + zoomDelta));
        this.map.setZoom(newZoom);

        // Get center after zoom
        const afterZoomLatLon = this.mapRenderer.getTileAtPixel(pixelX, pixelY);

        // Calculate difference and adjust center to keep cursor at same position
        const latDiff = afterZoomLatLon.lat - beforeZoomLatLon.lat;
        const lonDiff = afterZoomLatLon.lon - beforeZoomLatLon.lon;

        const center = this.map.getCenter();
        this.map.panTo([center.lat - latDiff, center.lng - lonDiff], { animate: false });
    }

    /**
     * Get tiles needed for current viewport
     */
    getVisibleTiles() {
        // Leaflet handles tile management internally
        // This method is here for compatibility but not needed with Leaflet
        const zoom = Math.round(this.map.getZoom());
        const bounds = this.map.getBounds();
        
        // Calculate which tiles are visible
        const tiles = [];
        const numTiles = Math.pow(2, zoom);
        
        // Convert bounds to tile coordinates
        const minTile = this.latLonToTile(bounds.getSouth(), bounds.getWest(), zoom);
        const maxTile = this.latLonToTile(bounds.getNorth(), bounds.getEast(), zoom);

        for (let y = Math.floor(minTile.y); y <= Math.ceil(maxTile.y); y++) {
            for (let x = Math.floor(minTile.x); x <= Math.ceil(maxTile.x); x++) {
                const wrappedX = ((x % numTiles) + numTiles) % numTiles;
                
                if (y >= 0 && y < numTiles) {
                    tiles.push({
                        z: zoom,
                        x: wrappedX,
                        y: y,
                    });
                }
            }
        }

        return tiles;
    }

    /**
     * Convert lat/lon to tile coordinates
     */
    latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const x = (lon + 180) / 360 * n;
        const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
        return { x, y };
    }

    /**
     * Get state for debugging
     */
    getState() {
        return {
            zoom: this.map.getZoom(),
            center: { lat: this.map.getCenter().lat, lon: this.map.getCenter().lng },
        };
    }

    /**
     * Log current map state for debugging
     */
    logState() {
        const state = this.getState();
        console.log(`🗺️ Map State:\n  Zoom: ${state.zoom}\n  Center: ${state.center.lat.toFixed(4)}°, ${state.center.lon.toFixed(4)}°`);
    }
}
