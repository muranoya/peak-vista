/**
 * UI Controller
 * Manages all UI interactions and updates
 */

export class UIController {
    constructor(app) {
        this.app = app;

        // DOM elements
        this.locationForm = document.getElementById('location-form');
        this.latInput = document.getElementById('lat-input');
        this.lonInput = document.getElementById('lon-input');
        this.angleInput = document.getElementById('angle-input');
        this.distanceInput = document.getElementById('distance-input');
        this.statusDiv = document.getElementById('status');

        // Create additional UI elements
        this.createAdvancedControls();
        this.setupEventListeners();
    }

    createAdvancedControls() {
        // Create a controls container
        const controlsContainer = document.getElementById('controls');

        // Add camera info panel
        const cameraPanel = document.createElement('div');
        cameraPanel.className = 'control-section';
        cameraPanel.id = 'camera-info';
        cameraPanel.innerHTML = `
            <h3>Camera Info</h3>
            <div class="info-grid">
                <div class="info-item">
                    <label>Distance:</label>
                    <span id="camera-distance">0 m</span>
                </div>
                <div class="info-item">
                    <label>Height:</label>
                    <span id="camera-height">0 m</span>
                </div>
                <div class="info-item">
                    <label>Bearing:</label>
                    <span id="camera-bearing">0°</span>
                </div>
                <div class="info-item">
                    <label>Tiles Loaded:</label>
                    <span id="tiles-loaded">0</span>
                </div>
            </div>
        `;
        controlsContainer.appendChild(cameraPanel);

        // Add preset locations
        const presetsPanel = document.createElement('div');
        presetsPanel.className = 'control-section';
        presetsPanel.id = 'preset-locations';
        presetsPanel.innerHTML = `
            <h3>Preset Locations</h3>
            <div class="preset-buttons">
                <button class="preset-btn" data-lat="35.360556" data-lon="138.727778" data-name="Mount Fuji">
                    Mount Fuji
                </button>
                <button class="preset-btn" data-lat="36.104611" data-lon="137.971111" data-name="North Alps">
                    North Alps
                </button>
                <button class="preset-btn" data-lat="35.957889" data-lon="137.468417" data-name="Central Alps">
                    Central Alps
                </button>
                <button class="preset-btn" data-lat="34.746236" data-lon="135.729816" data-name="Kyoto">
                    Kyoto
                </button>
            </div>
        `;
        controlsContainer.appendChild(presetsPanel);

        // Add action buttons
        const actionsPanel = document.createElement('div');
        actionsPanel.className = 'control-section';
        actionsPanel.id = 'actions';
        actionsPanel.innerHTML = `
            <h3>Actions</h3>
            <div class="action-buttons">
                <button id="reset-camera-btn" title="Reset camera to default position">Reset Camera</button>
                <button id="clear-cache-btn" title="Clear tile cache">Clear Cache</button>
                <button id="export-state-btn" title="Save current view">Save View</button>
            </div>
        `;
        controlsContainer.appendChild(actionsPanel);

        // Add keyboard help
        const helpPanel = document.createElement('div');
        helpPanel.className = 'control-section';
        helpPanel.id = 'keyboard-help';
        helpPanel.innerHTML = `
            <h3>Keyboard Controls</h3>
            <ul class="help-list">
                <li><kbd>Mouse Drag</kbd>: Rotate view</li>
                <li><kbd>Mouse Wheel</kbd>: Zoom in/out</li>
                <li><kbd>Arrow Keys</kbd>: Pan camera</li>
                <li><kbd>W/A/S/D</kbd>: Move camera</li>
                <li><kbd>+/-</kbd>: Zoom</li>
            </ul>
        `;
        controlsContainer.appendChild(helpPanel);

        // Add performance stats panel
        const statsPanel = document.createElement('div');
        statsPanel.className = 'control-section';
        statsPanel.id = 'performance-stats';
        statsPanel.innerHTML = `
            <h3>Performance</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <label>FPS:</label>
                    <span id="stat-fps">0</span>
                </div>
                <div class="stat-item">
                    <label>Frame Time:</label>
                    <span id="stat-frame-time">0 ms</span>
                </div>
                <div class="stat-item">
                    <label>Geometry:</label>
                    <span id="stat-geometry">0 MB</span>
                </div>
                <div class="stat-item">
                    <label>Triangles:</label>
                    <span id="stat-triangles">0</span>
                </div>
            </div>
        `;
        controlsContainer.appendChild(statsPanel);
    }

    setupEventListeners() {
        // Location form
        this.locationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const lat = parseFloat(this.latInput.value);
            const lon = parseFloat(this.lonInput.value);
            const angle = parseFloat(this.angleInput.value);
            const distance = parseFloat(this.distanceInput.value);

            if (this.validateCoordinates(lat, lon)) {
                this.app.loadView(lat, lon, angle, distance);
            }
        });

        // Preset location buttons
        document.querySelectorAll('.preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const lat = parseFloat(btn.dataset.lat);
                const lon = parseFloat(btn.dataset.lon);
                const name = btn.dataset.name;

                this.latInput.value = lat;
                this.lonInput.value = lon;
                this.angleInput.value = 180;
                this.distanceInput.value = 10;

                this.app.updateStatus(`Loading preset: ${name}`, 'loading');
                this.app.loadView(lat, lon, 180, 10);
            });
        });

        // Action buttons
        const resetCameraBtn = document.getElementById('reset-camera-btn');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                this.app.renderer.cameraController.resetCamera();
                this.app.updateStatus('Camera reset to default position', 'success');
            });
        }

        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                this.app.updateStatus('Clearing tile cache...', 'loading');
                await this.app.tileCache.clearAll();
                this.app.loadedTiles.clear();
                this.app.updateStatus('Tile cache cleared', 'success');
            });
        }

        const exportStateBtn = document.getElementById('export-state-btn');
        if (exportStateBtn) {
            exportStateBtn.addEventListener('click', () => {
                this.exportCurrentView();
            });
        }
    }

    validateCoordinates(lat, lon) {
        if (isNaN(lat) || isNaN(lon)) {
            this.app.updateStatus('Invalid coordinates', 'error');
            return false;
        }

        if (lat < -90 || lat > 90) {
            this.app.updateStatus('Latitude must be between -90 and 90', 'error');
            return false;
        }

        if (lon < -180 || lon > 180) {
            this.app.updateStatus('Longitude must be between -180 and 180', 'error');
            return false;
        }

        return true;
    }

    /**
     * Update camera info display and performance stats
     */
    updateCameraInfo(cameraController, loadedTiles, renderer, perfMonitor) {
        const spherical = cameraController.getSphericalCoordinates();
        const targetPoint = cameraController.getTargetPoint();

        // Calculate distance from center
        const dx = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        const dy = spherical.radius * Math.cos(spherical.phi);
        const dz = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
        const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;

        // Update camera display
        const distanceEl = document.getElementById('camera-distance');
        const heightEl = document.getElementById('camera-height');
        const bearingEl = document.getElementById('camera-bearing');
        const tilesEl = document.getElementById('tiles-loaded');

        if (distanceEl) {
            distanceEl.textContent = `${distanceFromCenter.toFixed(0)} m`;
        }
        if (heightEl) {
            heightEl.textContent = `${(dy + targetPoint.y).toFixed(0)} m`;
        }
        if (bearingEl) {
            bearingEl.textContent = `${((bearing + 360) % 360).toFixed(1)}°`;
        }
        if (tilesEl) {
            tilesEl.textContent = loadedTiles.size;
        }

        // Update performance stats
        if (perfMonitor && renderer) {
            const metrics = perfMonitor.getMetrics();
            const memStats = renderer.getMemoryStats();

            const fpsEl = document.getElementById('stat-fps');
            const frameTimeEl = document.getElementById('stat-frame-time');
            const geometryEl = document.getElementById('stat-geometry');
            const trianglesEl = document.getElementById('stat-triangles');

            if (fpsEl) {
                fpsEl.textContent = `${metrics.fps} FPS`;
            }
            if (frameTimeEl) {
                frameTimeEl.textContent = `${metrics.frameTime.toFixed(2)} ms`;
            }
            if (geometryEl) {
                geometryEl.textContent = `${memStats.geometryMemory} MB`;
            }
            if (trianglesEl) {
                trianglesEl.textContent = memStats.totalTriangles.toLocaleString();
            }
        }
    }

    /**
     * Export current view configuration
     */
    exportCurrentView() {
        const viewConfig = {
            timestamp: new Date().toISOString(),
            location: {
                lat: parseFloat(this.latInput.value),
                lon: parseFloat(this.lonInput.value),
            },
            view: {
                angle: parseFloat(this.angleInput.value),
                distance: parseFloat(this.distanceInput.value),
            },
            camera: this.app.renderer.cameraController.getState(),
        };

        const dataStr = JSON.stringify(viewConfig, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `peak-vista-view-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.app.updateStatus('View configuration exported', 'success');
    }

    /**
     * Import view configuration
     */
    async importViewConfiguration(file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);

            // Load view
            const { location, view } = config;
            this.latInput.value = location.lat;
            this.lonInput.value = location.lon;
            this.angleInput.value = view.angle;
            this.distanceInput.value = view.distance;

            // Load camera state
            if (config.camera) {
                this.app.renderer.cameraController.setState(config.camera);
            }

            this.app.loadView(location.lat, location.lon, view.angle, view.distance);
            this.app.updateStatus('View configuration imported', 'success');
        } catch (error) {
            this.app.updateStatus(`Failed to import view: ${error.message}`, 'error');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.app.updateStatus(`Error: ${message}`, 'error');
    }

    /**
     * Show info message
     */
    showInfo(message) {
        this.app.updateStatus(message, 'info');
    }
}
