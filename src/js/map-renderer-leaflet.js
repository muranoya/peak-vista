/**
 * Leaflet-based Map Renderer
 * Renders 2D map using Leaflet
 */

export class MapRenderer {
    constructor(mapContainerElement) {
        this.container = mapContainerElement;
        this.map = null;
        this.tileLayer = null;
        this.clickCallback = null;
        
        this.initLeafletMap();
    }

    /**
     * Initialize Leaflet map
     */
    initLeafletMap() {
        // Ensure container is visible for proper initialization
        const wasHidden = this.container.style.display === 'none' || 
                         window.getComputedStyle(this.container).display === 'none';
        
        if (wasHidden) {
            this.container.style.display = 'block';
        }

        // Create Leaflet map
        this.map = L.map(this.container, {
            center: [36.5, 138.0], // Japan center
            zoom: 8,
            minZoom: 5,
            maxZoom: 15,
            zoomControl: true,
            attributionControl: true,
        });

        // Add tile layer (GSI standard map)
        this.tileLayer = L.tileLayer(
            'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
            {
                attribution: '&copy; GSI | Map data &copy; OpenStreetMap contributors',
                maxZoom: 18,
                tileSize: 256,
                crossOrigin: 'anonymous',
            }
        ).addTo(this.map);

        // Handle map clicks
        this.map.on('click', (e) => {
            if (this.clickCallback) {
                this.clickCallback(e.latlng.lat, e.latlng.lng);
            }
        });

        // Trigger initial size calculation
        this.map.invalidateSize();

        // console.log('Leaflet map initialized');
    }

    /**
     * Set click callback
     */
    onMapClick(callback) {
        this.clickCallback = callback;
    }

    /**
     * Get map center coordinates
     */
    getCenter() {
        const center = this.map.getCenter();
        return {
            lat: center.lat,
            lon: center.lng,
        };
    }

    /**
     * Set map center
     */
    setCenter(lat, lon, zoom) {
        this.map.setView([lat, lon], zoom);
    }

    /**
     * Get current zoom level
     */
    getZoom() {
        return this.map.getZoom();
    }

    /**
     * Set zoom level
     */
    setZoom(zoom) {
        this.map.setZoom(zoom);
    }

    /**
     * Pan to location
     */
    panTo(lat, lon) {
        this.map.panTo([lat, lon]);
    }

    /**
     * Get lat/lon at pixel position (for click handling)
     */
    getTileAtPixel(pixelX, pixelY) {
        // Convert pixel coordinates to map coordinates
        const point = L.point(pixelX, pixelY);
        const latlng = this.map.containerPointToLatLng(point);
        return {
            lat: latlng.lat,
            lon: latlng.lng,
        };
    }

    /**
     * Get state for debugging
     */
    getState() {
        const center = this.map.getCenter();
        return {
            zoom: this.map.getZoom(),
            center: { lat: center.lat, lon: center.lng },
            bounds: this.map.getBounds(),
        };
    }

    /**
     * Animate to location
     */
    animate(callback) {
        const loop = () => {
            requestAnimationFrame(loop);
            if (callback) callback();
        };
        loop();
    }
}
