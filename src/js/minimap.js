/**
 * Minimap - Leaflet-based minimap overlay for 3D terrain view
 * Displays current camera position and viewing direction on a small map
 */

export class Minimap {
    constructor(terrainRenderer, terrainView) {
        this.terrainRenderer = terrainRenderer;
        this.terrainView = terrainView;

        // Leaflet map and layers
        this.map = null;
        this.tileLayer = null;
        this.cameraMarker = null;
        this.viewDirectionArrow = null;

        // Container element
        this.container = null;

        // State tracking
        this.lastCameraLat = null;
        this.lastCameraLon = null;
        this.lastYaw = null;
        this.isInitialized = false;

        // Update threshold - only update if position changes significantly (in degrees)
        // 0.0001 degrees ≈ 10 meters
        this.updateThreshold = 0.0001;
        // 0.05 radians ≈ 2.9 degrees
        this.yawThreshold = 0.05;
    }

    /**
     * Initialize the minimap
     */
    init() {
        // Get the minimap container from DOM
        this.container = document.getElementById('minimap');
        if (!this.container) {
            console.warn('Minimap container not found in DOM');
            return;
        }

        // Initialize Leaflet map (without markers yet, since viewpoint may not be set)
        this.initLeafletMap();
        this.isInitialized = true;

        // console.log('Minimap initialized - waiting for viewpoint');
    }

    /**
     * Initialize Leaflet map with GSI standard tile layer
     */
    initLeafletMap() {
        // Get initial viewpoint (may be null)
        const viewpoint = this.terrainView.currentViewpoint;
        const initialLat = viewpoint ? viewpoint.lat : 36.5;
        const initialLon = viewpoint ? viewpoint.lon : 138.0;

        // Create map with disabled interactions
        this.map = L.map(this.container, {
            center: [initialLat, initialLon],
            zoom: 15,
            minZoom: 13,
            maxZoom: 17,
            zoomControl: false,        // Hide zoom buttons
            attributionControl: false, // Hide attribution
            dragging: false,           // Disable dragging
            scrollWheelZoom: false,    // Disable scroll zoom
            doubleClickZoom: false,    // Disable double-click zoom
            touchZoom: false,          // Disable touch zoom
            boxZoom: false,            // Disable box zoom
            keyboard: false            // Disable keyboard navigation
        });

        // Add GSI standard map tile layer
        this.tileLayer = L.tileLayer(
            'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
            {
                attribution: '',
                maxZoom: 18,
                tileSize: 256,
                crossOrigin: 'anonymous',
            }
        ).addTo(this.map);

        // Ensure map is properly sized even when hidden
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 100);

        // console.log('Leaflet map initialized at', initialLat, initialLon);
    }

    /**
     * Reinitialize markers and arrows when viewpoint is set
     */
    reinitializeMarkers() {
        const viewpoint = this.terrainView.currentViewpoint;
        if (!viewpoint) {
            console.warn('Cannot reinitialize markers - no viewpoint set');
            return;
        }

        // Force Leaflet to recalculate map size
        this.map.invalidateSize();

        // Recreate camera marker
        if (this.cameraMarker) {
            this.map.removeLayer(this.cameraMarker);
        }

        this.cameraMarker = L.circleMarker([viewpoint.lat, viewpoint.lon], {
            radius: 6,
            color: '#0088ff',
            fillColor: '#0088ff',
            fillOpacity: 1,
            weight: 2
        }).addTo(this.map);

        // Recreate view direction arrow
        this.createViewDirectionArrow(viewpoint.lat, viewpoint.lon, 0);

        // Update map center to viewpoint
        this.map.setView([viewpoint.lat, viewpoint.lon], 15, { animate: false });

        // Reset position tracking
        this.lastCameraLat = viewpoint.lat;
        this.lastCameraLon = viewpoint.lon;
        this.lastYaw = 0;
    }

    /**
     * Create view direction arrow
     */
    createViewDirectionArrow(lat, lon, yaw) {
        // Calculate arrow end point based on yaw
        const arrowLength = 0.0015; // About 150-200m in degrees
        const endLat = lat + Math.cos(yaw) * arrowLength;
        const endLon = lon + Math.sin(yaw) * arrowLength;

        // Create or update arrow
        if (this.viewDirectionArrow) {
            // Update existing arrow's coordinates (more efficient than recreating)
            this.viewDirectionArrow.setLatLngs([
                [lat, lon],
                [endLat, endLon]
            ]);
        } else {
            // Create new green polyline arrow (first time only)
            this.viewDirectionArrow = L.polyline([
                [lat, lon],
                [endLat, endLon]
            ], {
                color: '#88ff00',
                weight: 3,
                opacity: 0.9
            }).addTo(this.map);
        }
    }

    /**
     * Convert Three.js world coordinates to latitude/longitude
     * @param {number} worldX - World X coordinate (meters, east)
     * @param {number} worldZ - World Z coordinate (meters, north)
     * @returns {Object} {lat, lon} in degrees
     */
    worldToLatLon(worldX, worldZ) {
        const viewpoint = this.terrainView.currentViewpoint;
        if (!viewpoint) {
            return { lat: 0, lon: 0 };
        }

        // Meters per degree (approximate)
        const metersPerLatDegree = 111320;
        const metersPerLonDegree = 111320 * Math.cos(viewpoint.lat * Math.PI / 180);

        // Calculate latitude/longitude offset from world coordinates
        const latOffset = worldZ / metersPerLatDegree;
        const lonOffset = worldX / metersPerLonDegree;

        return {
            lat: viewpoint.lat + latOffset,
            lon: viewpoint.lon + lonOffset
        };
    }

    /**
     * Update minimap with current camera position and view direction
     */
    update() {
        // If map is not initialized or markers don't exist, try to reinitialize
        if (!this.map) {
            return;
        }

        // If markers haven't been created yet, try to create them now
        if (!this.cameraMarker || !this.viewDirectionArrow) {
            const viewpoint = this.terrainView.currentViewpoint;
            if (viewpoint) {
                this.reinitializeMarkers();
            } else {
                // Still no viewpoint, can't update
                return;
            }
        }

        // Get current camera position (in world coordinates)
        const cameraPos = this.terrainRenderer.cameraController.getCameraPosition();

        // Convert world coordinates to lat/lon
        const cameraLatLon = this.worldToLatLon(cameraPos.x, cameraPos.z);

        // Get view direction
        const viewDir = this.terrainRenderer.cameraController.getViewDirection();
        const yaw = viewDir.yaw;

        // Calculate position changes
        const latDelta = this.lastCameraLat !== null ?
            Math.abs(cameraLatLon.lat - this.lastCameraLat) : Infinity;
        const lonDelta = this.lastCameraLon !== null ?
            Math.abs(cameraLatLon.lon - this.lastCameraLon) : Infinity;

        // Update camera marker position (with threshold to reduce updates)
        if (
            this.lastCameraLat === null ||
            latDelta > this.updateThreshold ||
            lonDelta > this.updateThreshold
        ) {
            // Always update marker position
            this.cameraMarker.setLatLng([cameraLatLon.lat, cameraLatLon.lon]);

            // Always keep map centered on camera position
            this.map.setView([cameraLatLon.lat, cameraLatLon.lon], this.map.getZoom(), {
                animate: false
            });

            this.lastCameraLat = cameraLatLon.lat;
            this.lastCameraLon = cameraLatLon.lon;
        }

        // Update view direction arrow if yaw changed significantly
        if (this.lastYaw === null || Math.abs(yaw - this.lastYaw) > this.yawThreshold) {
            this.createViewDirectionArrow(cameraLatLon.lat, cameraLatLon.lon, yaw);
            this.lastYaw = yaw;
        }
    }

    /**
     * Show minimap
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            // Ensure map is properly sized when shown
            if (this.map) {
                setTimeout(() => this.map.invalidateSize(), 50);
            }
        }
    }

    /**
     * Hide minimap
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Toggle minimap visibility
     */
    toggle() {
        if (this.container) {
            this.container.style.display =
                this.container.style.display === 'none' ? 'block' : 'none';
            // Ensure map is properly sized when toggled to visible
            if (this.container.style.display !== 'none' && this.map) {
                setTimeout(() => this.map.invalidateSize(), 50);
            }
        }
    }

    /**
     * Called when terrain view changes (user clicked new location)
     * Updates minimap for new viewpoint
     */
    onViewpointChanged() {
        // console.log('Minimap detected viewpoint change');
        this.reinitializeMarkers();
    }

    /**
     * Debug: Log minimap state and position
     */
    logState() {
        const cameraPos = this.terrainRenderer.cameraController.getCameraPosition();
        const cameraLatLon = this.worldToLatLon(cameraPos.x, cameraPos.z);
        const viewpoint = this.terrainView.currentViewpoint;

        console.group('🗺️ Minimap Debug State');
        console.log('Minimap initialized:', this.isInitialized);
        console.log('Map object exists:', !!this.map);
        console.log('Camera marker exists:', !!this.cameraMarker);
        console.log('View direction arrow exists:', !!this.viewDirectionArrow);
        console.log('Current viewpoint:', viewpoint);
        console.log('World camera position:', cameraPos);
        console.log('Converted lat/lon:', cameraLatLon);
        console.log('Last recorded position:', {
            lat: this.lastCameraLat,
            lon: this.lastCameraLon
        });
        console.log('Update threshold (degrees):', this.updateThreshold);
        if (this.map) {
            console.log('Map center:', this.map.getCenter());
            console.log('Map zoom:', this.map.getZoom());
            console.log('Map container size:', {
                width: this.map.getContainer().offsetWidth,
                height: this.map.getContainer().offsetHeight
            });
        }
        console.groupEnd();
    }
}
